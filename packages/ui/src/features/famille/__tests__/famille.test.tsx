// Native-only modules pulled in by the sheets and the map: their published jest mocks.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('../../../map', () => ({ NayaMap: () => null }));
import { AccessibilityInfo, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { familyLabel, familyNotificationCopy, HandoverCode, PhaseAnnouncer } from '../parts';

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
