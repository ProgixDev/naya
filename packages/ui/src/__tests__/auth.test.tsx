jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('../map', () => ({ NayaMap: () => null, mapEngine: 'test' }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'notification-1'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  dismissNotificationAsync: jest.fn(async () => undefined),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import type { ApiClient } from '@naya/api';
import { ApiProvider } from '@naya/api/react';
import { OtpScreen, PhoneSignInScreen } from '../features/auth';
import { DevLauncherGesture } from '../features/DevLauncher';

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const notifications = jest.mocked(Notifications);

const clients: QueryClient[] = [];
afterEach(() => {
  for (const qc of clients.splice(0)) qc.clear();
  jest.clearAllMocks();
});

function authApi() {
  return {
    auth: {
      requestOtp: jest.fn(async () => ({ expiresAt: '2026-10-14T10:05:00Z', resendAvailableAt: '2026-10-14T10:00:30Z', delivery: 'demo' as const })),
      verifyOtp: jest.fn(async (phone: string) => ({ token: 't-1', isNew: true, user: { id: 'PA-9', phone } })),
    },
  };
}

function renderWith(ui: ReactNode, api: ReturnType<typeof authApi>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  clients.push(qc);
  return render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <ApiProvider client={api as unknown as ApiClient}>
        <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
      </ApiProvider>
    </SafeAreaProvider>,
  );
}

async function sendCode(api: ReturnType<typeof authApi>, digits: string, onCodeSent = jest.fn()) {
  const view = await renderWith(<PhoneSignInScreen role="passenger" title="Votre numéro" subtitle="" legal={null} onCodeSent={onCodeSent} />, api);
  await fireEvent.changeText(screen.getByTestId('phone-input'), digits);
  await fireEvent.press(screen.getByTestId('send-code'));
  await waitFor(() => expect(onCodeSent).toHaveBeenCalled());
  await view.unmount();
  return onCodeSent;
}

/** Nothing on the device stands in for the SMS: no notification, no permission prompt. */
function expectNoNotificationUse() {
  expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
}

describe('sign-in', () => {
  it('signs in any Moroccan number, with no demo wording and no notification prompt', async () => {
    const api = authApi();
    await renderWith(<PhoneSignInScreen role="passenger" title="Votre numéro" subtitle="" legal={null} onCodeSent={jest.fn()} />, api);
    expect(screen.queryByTestId('demo-account')).toBeNull();
    expect(screen.queryByText(/d[ée]mo|simul|aucun sms/i)).toBeNull();
    await screen.unmount();
    const onCodeSent = await sendCode(api, '0677123456');
    expect(api.auth.requestOtp).toHaveBeenCalledWith('+212677123456', 'passenger');
    expect(onCodeSent).toHaveBeenCalledWith('+212677123456');
    expectNoNotificationUse();
  });

  it('asks for the code sent by SMS, never shows or prefills one, and verifies on the 6th digit', async () => {
    jest.useFakeTimers();
    try {
      const api = authApi();
      const onVerified = jest.fn();
      await renderWith(<OtpScreen role="passenger" phone="+212677000102" onBack={jest.fn()} onVerified={onVerified} />, api);
      expect(screen.getByText('Entrez le code')).toBeTruthy();
      expect(screen.getByText('Envoyé par SMS au +212 6 77 00 01 02')).toBeTruthy();
      // Nothing arrives on the screen a moment later: no message card, no code, no hint about which code works.
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(screen.getByTestId('otp-input').props.value).toBe('');
      expect(screen.getByTestId('otp-input').props.textContentType).toBe('oneTimeCode');
      expect(screen.queryByTestId('sms-code')).toBeNull();
      expect(screen.queryByText(/nouveau message|votre code est|propos[ée]|n’importe|d[ée]mo|\d{6}/i)).toBeNull();
      expect(screen.getByTestId('verify-code')).toBeDisabled();
      await fireEvent.changeText(screen.getByTestId('otp-input'), '48291');
      expect(api.auth.verifyOtp).not.toHaveBeenCalled();
      await fireEvent.changeText(screen.getByTestId('otp-input'), '482913');
      await waitFor(() => expect(onVerified).toHaveBeenCalledWith('t-1', 'PA-9', true));
      expect(api.auth.verifyOtp).toHaveBeenCalledTimes(1);
      expect(api.auth.verifyOtp).toHaveBeenCalledWith('+212677000102', 'passenger', '482913');
      expectNoNotificationUse();
      await screen.unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('scenario launcher entry', () => {
  it('is an invisible 2 s long press, hidden from screen readers', async () => {
    const onOpen = jest.fn();
    await render(<DevLauncherGesture onOpen={onOpen} />);
    expect(screen.queryByTestId('dev-launcher-gesture')).toBeNull(); // not exposed to assistive tech
    const target = screen.getByTestId('dev-launcher-gesture', { includeHiddenElements: true });
    expect(target.props.accessible).toBe(false);
    expect(screen.queryByText(/./, { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(target);
    expect(onOpen).not.toHaveBeenCalled();
    await fireEvent(target, 'longPress');
    expect(onOpen).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });
});
