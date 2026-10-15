jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { DriverSummary } from '@naya/domain';
import { HoldToConfirmButton } from '../features/prototype';
import { DriverCard, RouteStopRow, TransactionRow } from '../Ride';

/** Redesign audit 2026-10-15, batch B3: SOS hold (R10), the plate as hero (P-56), stops (A4), ledger glyphs (C18). */

describe('HoldToConfirmButton (R10)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const hold = (onConfirm: () => void) =>
    render(<HoldToConfirmButton label="Maintenez pour alerter" accessibilityLabel="Envoyer l’alerte de sécurité" hint="Gardez le doigt sur le bouton 1,5 seconde pour envoyer l’alerte." onConfirm={onConfirm} testID="hold" />);

  it('fires only once the button has been held for 1.5 s', async () => {
    const onConfirm = jest.fn();
    await hold(onConfirm);
    const button = screen.getByTestId('hold');
    await fireEvent(button, 'pressIn');
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await fireEvent(button, 'pressOut');
    expect(onConfirm).not.toHaveBeenCalled();
    // An early release says how to send.
    expect(screen.getByTestId('hold-hint')).toBeTruthy();

    await fireEvent(button, 'pressIn');
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await fireEvent(button, 'pressOut');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('sends at once from a screen reader, which cannot hold', async () => {
    const onConfirm = jest.fn();
    await hold(onConfirm);
    const button = screen.getByRole('button', { name: 'Envoyer l’alerte de sécurité' });
    await fireEvent(button, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

const amina: DriverSummary = {
  id: 'drv-amina' as DriverSummary['id'],
  firstName: 'Amina',
  lastInitial: 'B',
  ratingAverage: 4.8,
  phoneMasked: '+212 6•• •• •• 21',
  vehicle: { make: 'Dacia', model: 'Logan', color: 'Blanche', plate: '48213-A-1' },
};

describe('DriverCard (P-56)', () => {
  it('leads with the plate, then the car, then who drives it', async () => {
    await render(<DriverCard driver={amina} />);
    expect(screen.getByLabelText('Immatriculation 48213-A-1')).toBeTruthy();
    expect(screen.getByText('Dacia Logan · Blanche')).toBeTruthy();
    expect(screen.getByLabelText('Amina B., note 4,8 sur 5')).toBeTruthy();
    // A5: the role word is gone; the card is the chauffeuse.
    expect(screen.queryByText(/Chauffeuse/)).toBeNull();
  });

  it('enlarges the plate once she has arrived', async () => {
    await render(<DriverCard driver={amina} arrived />);
    const plate = screen.getByText('48213-A-1');
    const style = Object.assign({}, ...[plate.props.style].flat(Infinity).filter(Boolean));
    expect(style.fontSize).toBe(28);
  });
});

describe('RouteStopRow (A4)', () => {
  it('draws a done stop as a check and says it to screen readers only', async () => {
    const place = { label: 'Agdal', address: 'Avenue de France', location: { lat: 33.99, lng: -6.85 } };
    await render(<RouteStopRow compact role="stop" place={place as never} done testID="stop" />);
    expect(screen.queryByText(/effectué/)).toBeNull();
    expect(screen.getByLabelText('Arrêt, effectué : Agdal')).toBeTruthy();
    expect(screen.getByTestId('icon-CircleCheck', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('TransactionRow (C18)', () => {
  it('names each ledger type with its own glyph', async () => {
    await render(<TransactionRow entry={{ id: 'L1', type: 'ride_commission', amount: -1500, createdAt: '2026-10-15T10:00:00Z', rideId: 'NY-001' } as never} />);
    expect(screen.getByTestId('icon-Percent', { includeHiddenElements: true })).toBeTruthy();
    await render(<TransactionRow entry={{ id: 'L2', type: 'withdrawal', amount: -5000, createdAt: '2026-10-15T10:00:00Z', rideId: null } as never} />);
    expect(screen.getByTestId('icon-Landmark', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('icon-ArrowUpRight', { includeHiddenElements: true })).toBeNull();
  });
});
