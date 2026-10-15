// Native-only modules pulled in by the sheets and the map: their published jest mocks.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('../../../map', () => ({ NayaMap: () => null }));
import { AccessibilityInfo, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { approvalWindowSeconds, FamilleTimeline, familyLabel, familyNotificationCopy, formatCountdown, HandoverCode, PhaseAnnouncer, placeNameNear } from '../parts';

const trip = { childName: 'Sami', destination: { label: 'École Al Massira' } } as Parameters<typeof familyNotificationCopy>[1];

describe('Famille copy (FS-15)', () => {
  it('never forces a feminine agreement on the child', () => {
    const approval = familyNotificationCopy({ kind: 'approval_request', title: 'Sami est prête à partir', body: 'Amina attend votre accord pour démarrer.' }, trip);
    expect(approval.title).toBe('Départ de Sami à approuver');
    const dropped = familyNotificationCopy({ kind: 'status', title: 'Sami est arrivée', body: 'Déposée à École Al Massira · photo jointe.' }, trip);
    expect(dropped).toEqual({ title: 'Dépôt confirmé · Sami', body: 'École Al Massira · photo jointe.' });
    // The chauffeuse is always a woman: her own arrival keeps its wording.
    expect(familyNotificationCopy({ kind: 'status', title: 'Amina est arrivée', body: 'Hay Riad' }, trip).title).toBe('Amina est arrivée');
  });

  it('drops « invité·e » from timeline lines', () => {
    expect(familyLabel('Youssef (Père) invité·e à suivre les trajets')).toBe('Youssef (Père) · invitation à suivre les trajets');
  });
});

describe('HandoverCode (FS-12)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is masked until tapped, says the digits when shown, and masks itself again', async () => {
    await render(<HandoverCode name="Salma" relationship="Mère" code="1234" testID="code" />);
    expect(screen.getByTestId('code-value')).toHaveTextContent('••••');
    expect(screen.queryByText('1234')).toBeNull();
    expect(screen.getByTestId('code').props.accessibilityLabel).toBe('Code de remise de Salma, masqué');

    await fireEvent.press(screen.getByTestId('code'));
    expect(screen.getByTestId('code-value')).toHaveTextContent('1234');
    expect(screen.getByTestId('code').props.accessibilityLabel).toBe('Code de remise de Salma : 1 2 3 4');

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(screen.getByTestId('code-value')).toHaveTextContent('••••');
  });
});

describe('PhaseAnnouncer (FS-14)', () => {
  it('says each phase once, even when the approval card is mounted twice', async () => {
    const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const tree = (m: string | null) => (
      <View>
        <PhaseAnnouncer message={m} />
        <PhaseAnnouncer message={m} />
      </View>
    );
    const { rerender } = await render(tree('Amina demande à démarrer. Vérifiez la photo puis répondez.'));
    expect(say).toHaveBeenCalledTimes(1);
    // A re-render with the same phase (a countdown tick) says nothing.
    await rerender(tree('Amina demande à démarrer. Vérifiez la photo puis répondez.'));
    expect(say).toHaveBeenCalledTimes(1);
    await rerender(tree('Moins de 30 secondes pour répondre à la demande de départ.'));
    expect(say).toHaveBeenCalledTimes(2);
    expect(say).toHaveBeenLastCalledWith('Moins de 30 secondes pour répondre à la demande de départ.');
    say.mockRestore();
  });
});

describe('Famille journal (P-64)', () => {
  const school = { label: 'École Al Massira', location: { lat: 33.9594, lng: -6.8747 } };
  const home = { label: 'Hay Riad', location: { lat: 33.9591, lng: -6.8619 } };

  it('names the place near a line and never prints raw coordinates', async () => {
    const trip = {
      pickup: home,
      destination: school,
      timeline: [
        { at: '2026-10-15T07:00:00.000Z', label: 'Photo de prise en charge', kind: 'pickup_photo' as const, location: { lat: 33.95911, lng: -6.86191 }, proof: 'p1' },
        { at: '2026-10-15T07:20:00.000Z', label: 'Position partagée', location: { lat: 34.02, lng: -6.83 } },
        { at: '2026-10-15T07:30:00.000Z', label: 'Déposé', kind: 'completed' as const, location: { lat: 33.9594, lng: -6.8747 } },
      ],
    };
    await render(<FamilleTimeline trip={trip as never} testID="tl" />);
    const text = JSON.stringify(screen.toJSON());
    expect(text).not.toMatch(/33\.95|-6\.8|34\.02/);
    expect(screen.getByText(/Hay Riad · photo jointe/)).toBeTruthy();
    expect(screen.getByText(/École Al Massira/)).toBeTruthy();
  });

  it('matches a place within 250 m only', () => {
    expect(placeNameNear({ lat: 33.9594, lng: -6.8747 }, [home, school])).toBe('École Al Massira');
    expect(placeNameNear({ lat: 34.02, lng: -6.83 }, [home, school])).toBeNull();
    expect(placeNameNear(undefined, [home])).toBeNull();
  });
});

describe('Approval countdown (P-65)', () => {
  it('reads minutes and seconds, from the server window', () => {
    expect(formatCountdown(125)).toBe('2 min 05 s');
    expect(approvalWindowSeconds({ requestedAt: '2026-10-15T07:00:00.000Z', expiresAt: '2026-10-15T07:03:00.000Z' })).toBe(180);
    expect(approvalWindowSeconds(null)).toBeGreaterThan(0);
  });
});
