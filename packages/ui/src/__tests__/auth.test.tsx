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

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import type { ApiClient } from '@naya/api';
import { ApiProvider } from '@naya/api/react';
import { OtpScreen, PhoneSignInScreen } from '../features/auth';
import { DevLauncherGesture } from '../features/DevLauncher';

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const notifications = jest.mocked(Notifications);
const permission = (granted: boolean, status: 'granted' | 'denied' | 'undetermined' = granted ? 'granted' : 'denied') =>
  ({ granted, status, canAskAgain: status === 'undetermined', expires: 'never' }) as unknown as Notifications.NotificationPermissionsStatus;

const clients: QueryClient[] = [];
afterEach(() => {
  for (const qc of clients.splice(0)) qc.clear();
  jest.clearAllMocks();
});

function authApi() {
  return {
    auth: {
      requestOtp: jest.fn(async () => ({ expiresAt: '2026-10-14T10:05:00Z', resendAvailableAt: '2026-10-14T10:00:30Z', demoCode: '123456', delivery: 'demo' as const })),
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

describe('sign-in', () => {
  it('signs in any Moroccan number, with no demo account or demo wording', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permission(false));
    const api = authApi();
    await renderWith(<PhoneSignInScreen role="passenger" title="Votre numéro" subtitle="" legal={null} onCodeSent={jest.fn()} />, api);
    expect(screen.queryByTestId('demo-account')).toBeNull();
    expect(screen.queryByText(/d[ée]mo|simul|aucun sms/i)).toBeNull();
    await screen.unmount();
    const onCodeSent = await sendCode(api, '0677123456');
    expect(api.auth.requestOtp).toHaveBeenCalledWith('+212677123456', 'passenger');
    expect(onCodeSent).toHaveBeenCalledWith('+212677123456');
  });

  it('delivers the code as a « Naya » notification when notifications are allowed', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permission(true));
    await sendCode(authApi(), '677000101');
    await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));
    const request = notifications.scheduleNotificationAsync.mock.calls[0]![0];
    expect(request.content).toMatchObject({ title: 'Naya', body: 'Votre code de connexion Naya : 123456' });
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks for notification permission once, then falls back to an in-app text message', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permission(false, 'undetermined'));
    notifications.requestPermissionsAsync.mockResolvedValue(permission(false));
    const api = authApi();
    await sendCode(api, '677000102');
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    const onVerified = jest.fn();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderWith(<OtpScreen role="passenger" phone="+212677000102" onBack={jest.fn()} onVerified={onVerified} />, api);
    // The code is never pre-filled: it arrives like a text message a moment later.
    expect(screen.getByTestId('otp-input').props.value).toBe('');
    const message = await screen.findByTestId('sms-code', {}, { timeout: 4000 });
    expect(message.props.accessibilityLabel).toBe('Nouveau message · Naya : votre code est 123456');
    // VoiceOver hears it arrive, as it would hear a text message.
    expect(announce).toHaveBeenCalledWith('Nouveau message de Naya : votre code est 1 2 3 4 5 6');
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    await fireEvent.press(message);
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('t-1', 'PA-9', true));
    expect(api.auth.verifyOtp).toHaveBeenCalledWith('+212677000102', 'passenger', '123456');
    expect(screen.queryByTestId('sms-code')).toBeNull();
    await screen.unmount();
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
