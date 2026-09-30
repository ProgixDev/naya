import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { computeFare, mad, RABAT_RULES } from '@naya/domain';
import { serverClock } from '@naya/api';
import { useDeadline } from '@naya/api/react';
import { Button } from '../Button';
import { OTPField, Pill } from '../Form';
import { SegmentedControl } from '../SegmentedControl';
import { CountdownRing, FareBreakdown, WalletSummary } from '../Ride';
import { StatusBanner } from '../Feedback';
import { useSingleFlight } from '../core/useSingleFlight';

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: ReactNode) => <SafeAreaProvider initialMetrics={safeArea}>{ui}</SafeAreaProvider>;

describe('Button', () => {
  it('fires once per press when enabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Confirmer · 100 MAD" onPress={onPress} testID="b" />);
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is busy and inert while loading, keeping its label for width', async () => {
    const onPress = jest.fn();
    await render(<Button label="Retirer" loading loadingLabel="Envoi sécurisé…" onPress={onPress} testID="b" />);
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('b')).toBeBusy();
    expect(screen.getByTestId('b')).toBeDisabled();
    expect(screen.getByText('Retirer')).toBeTruthy();
    expect(screen.getByText('Envoi sécurisé…')).toBeTruthy();
  });

  it('explains why it is disabled', async () => {
    await render(<Button label="Voir l’estimation" disabled disabledReason="Une adresse est hors zone." testID="b" />);
    expect(screen.getByTestId('b')).toBeDisabled();
    expect(screen.getByText('Une adresse est hors zone.')).toBeTruthy();
  });
});

describe('OTPField', () => {
  it('accepts a pasted code, strips non-digits and completes once', async () => {
    const onChange = jest.fn();
    const onComplete = jest.fn();
    await render(<OTPField value="" onChange={onChange} onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByTestId('otp-input'), '12 34-56');
    expect(onChange).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('announces errors', async () => {
    await render(<OTPField value="12" onChange={() => {}} error="Code incorrect. Vérifiez le SMS et réessayez." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Code incorrect. Vérifiez le SMS et réessayez.');
  });
});

describe('Pill and SegmentedControl', () => {
  it('pill exposes its selected state', async () => {
    await render(<Pill label="Mes plans ont changé" selected testID="p" />);
    expect(screen.getByTestId('p')).toBeSelected();
  });

  it('segmented control changes value and marks the selected tab', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl options={[{ value: 'now', label: 'Maintenant' }, { value: 'later', label: 'Planifier' }]} value="now" onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toBeSelected();
    expect(tabs[1]).not.toBeSelected();
    await fireEvent.press(screen.getByText('Planifier'));
    expect(onChange).toHaveBeenCalledWith('later');
  });
});

describe('Money components', () => {
  it('fare breakdown discloses the ×1,2 surcharge and its reason before the total', async () => {
    const fare = computeFare(RABAT_RULES, 10_000, 1500, 12_000);
    await render(<FareBreakdown fare={fare} distanceMeters={10_000} durationSeconds={1500} dynamicReason="Forte demande autour de la gare." />);
    expect(screen.getByText('Demande élevée ×1,2')).toBeTruthy();
    expect(screen.getByText('+20 MAD')).toBeTruthy();
    expect(screen.getByText('Forte demande autour de la gare.')).toBeTruthy();
    expect(screen.getByText('120 MAD')).toBeTruthy();
  });

  it('wallet keeps balance, available, reserved and debt as distinct labelled figures', async () => {
    await render(
      <WalletSummary
        wallet={{ driverId: 'DR-001', cityId: 'rabat', currency: 'MAD', balance: mad(70), reserved: mad(50), available: mad(20), debt: 0, debtLimit: mad(150), offersBlockedByDebt: false, pendingRecharges: 0, updatedAt: '2026-10-01T08:00:00Z' }}
      />,
    );
    expect(screen.getByText('Solde comptable')).toBeTruthy();
    expect(screen.getByLabelText('Disponible au retrait 20 MAD')).toBeTruthy();
    expect(screen.getByLabelText('Réservé (retrait en cours) 50 MAD')).toBeTruthy();
    expect(screen.getByLabelText('Dette de commission 0 MAD / 150 MAD')).toBeTruthy();
  });

  it('countdown ring announces the remaining seconds and turns urgent under 10 s', async () => {
    const { rerender } = await render(<CountdownRing seconds={24} />);
    expect(screen.getByLabelText('24 secondes restantes')).toBeTruthy();
    await rerender(<CountdownRing seconds={5} />);
    expect(screen.getByLabelText('5 secondes restantes')).toBeTruthy();
  });

  it('status banner reads as an alert with its sentence', async () => {
    await render(wrap(<StatusBanner tone="danger" title="Plafond de dette atteint" message="Solde : −150 MAD." />));
    expect(screen.getByRole('alert', { name: 'Plafond de dette atteint. Solde : −150 MAD.' })).toBeTruthy();
  });
});

describe('useDeadline (offer countdown)', () => {
  beforeEach(() => jest.useFakeTimers({ now: Date.parse('2026-10-01T08:00:00Z') }));
  afterEach(() => {
    jest.useRealTimers();
    serverClock.skewMs = 0;
  });

  it('counts down against the authoritative deadline and never resets on re-render', async () => {
    const expiresAt = '2026-10-01T08:00:30.000Z';
    const { result, rerender } = await renderHook(() => useDeadline(expiresAt));
    expect(result.current.seconds).toBe(30);
    await act(async () => { jest.advanceTimersByTime(12_000); });
    await rerender({});
    expect(result.current.seconds).toBe(18);
    await act(async () => { jest.advanceTimersByTime(18_000); });
    expect(result.current.expired).toBe(true);
    expect(result.current.seconds).toBe(0);
  });

  it('uses the server clock when the device clock is wrong', async () => {
    serverClock.skewMs = 10_000; // server is 10 s ahead of this phone
    const { result } = await renderHook(() => useDeadline('2026-10-01T08:00:30.000Z'));
    expect(result.current.seconds).toBe(20);
  });
});

describe('useSingleFlight (financial and booking actions)', () => {
  it('sends one request for a double tap and keeps the same idempotency key on retry', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { gcTime: 0 } } });
    const keys: string[] = [];
    let fail = true;
    const fn = jest.fn(async (_v: void, key: string) => {
      keys.push(key);
      await new Promise((r) => setTimeout(r, 10));
      if (fail) throw new Error('réseau');
      return 'ok';
    });
    const { result } = await renderHook(() => useSingleFlight(fn), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
    await act(async () => {
      result.current.run();
      result.current.run();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(fn).toHaveBeenCalledTimes(1);
    fail = false;
    await act(async () => {
      result.current.run();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(keys[0]).toBe(keys[1]);
    qc.clear();
  });
});
