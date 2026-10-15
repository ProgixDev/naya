import { act, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import { STATUS_GLYPHS, STATUS_KINDS, STATUS_STATES, statusPresentation, type StatusKind, type StatusStates } from '@naya/domain';
import { GLYPHS, Icon } from '../Icon';
import { StatusIcon } from '../StatusIcon';
import { StatusBanner, StatusPill } from '../Feedback';
import { PAYMENT_ICONS, paymentMethodIcon, washPaymentIcon } from '../paymentIcons';

// jest.setup.js mocks lucide: every icon renders as a View with testID icon-<Name>.
const glyphOf = (testID = 's') => screen.getByTestId(`${testID}-glyph`, { includeHiddenElements: true });
const iconName = (testID = 's') => within(glyphOf(testID)).queryAllByTestId(/^icon-/, { includeHiddenElements: true })[0]?.props.testID as string | undefined;

describe('GLYPHS', () => {
  it('maps every domain glyph name to a distinct lucide component', () => {
    for (const g of STATUS_GLYPHS) expect(GLYPHS[g]).toBeDefined();
    expect(new Set(STATUS_GLYPHS.map((g) => GLYPHS[g])).size).toBe(STATUS_GLYPHS.length);
  });

  it('draws a different glyph for each state of a kind', async () => {
    for (const kind of ['ride', 'document', 'familyTrip', 'support'] as StatusKind[]) {
      const drawn = new Set<string | undefined>();
      for (const state of STATUS_STATES[kind]) {
        const view = await render(<StatusIcon kind={kind} state={state as StatusStates[typeof kind]} showLabel={false} testID="s" />);
        drawn.add(iconName());
        await view.unmount();
      }
      expect(drawn.size).toBe(STATUS_STATES[kind].length);
    }
  });
});

describe('StatusIcon', () => {
  beforeEach(() => jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false));
  afterEach(() => jest.restoreAllMocks());

  it('shows the glyph alone for a routine state, with the sentence for screen readers (R1)', async () => {
    await render(<StatusIcon kind="document" state="in_review" testID="s" />);
    expect(screen.getByRole('image', { name: 'Pièce en vérification' })).toBeTruthy();
    expect(screen.queryByText('En vérification')).toBeNull();
    expect(iconName()).toBe('icon-ScanSearch');
  });

  it('keeps the word for a problem, and reads the full sentence once', async () => {
    await render(<StatusIcon kind="document" state="rejected" testID="s" />);
    expect(screen.getByText('Refusé')).toBeTruthy();
    expect(screen.getByLabelText('Pièce refusée, à renvoyer')).toBeTruthy();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('forces the word on a hero, or hides it on request', async () => {
    const view = await render(<StatusIcon kind="verification" state="approved" size="lg" variant="disc" showLabel testID="s" />);
    expect(screen.getByText('Approuvé')).toBeTruthy();
    expect(iconName()).toBe('icon-BadgeCheck');
    await view.rerender(<StatusIcon kind="verification" state="rejected" showLabel={false} testID="s" />);
    expect(screen.queryByText('Refusé')).toBeNull();
    expect(screen.getByRole('image', { name: 'Dossier refusé' })).toBeTruthy();
  });

  it('can show the full sentence on a hero line', async () => {
    await render(<StatusIcon kind="walletDebit" state="failed" showLabel wording="full" testID="s" />);
    expect(screen.getByText('Montant libéré · rien n’a été débité')).toBeTruthy();
  });

  it('stays out of the way inside an accessible row', async () => {
    await render(<StatusIcon kind="ride" state="completed" accessible={false} testID="s" />);
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.getByTestId('s', { includeHiddenElements: true }).props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('puts the state as a badge on a payment-method glyph', async () => {
    await render(<StatusIcon kind="payment" state="failed" badgeOn={<Icon icon={paymentMethodIcon('card')} size={24} />} testID="s" />);
    expect(screen.getByTestId('s-badge', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('icon-CreditCard', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Échoué')).toBeTruthy();
  });

  it('reads the chauffeuse’s sentence for a Famille approval', async () => {
    await render(<StatusIcon kind="familyTrip" state="awaiting_approval" viewer="driver" testID="s" />);
    expect(screen.getByText('Accord du parent')).toBeTruthy();
    expect(screen.getByLabelText('Accord du parent attendu')).toBeTruthy();
  });

  it('animates searching on the native driver', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<StatusIcon kind="ride" state="searching" testID="s" />);
    await act(async () => undefined);
    expect(timing).toHaveBeenCalled();
    expect(timing.mock.calls.every(([, config]) => config.useNativeDriver === true)).toBe(true);
  });

  it('stops every animation under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const loops: { start: jest.Mock; stop: jest.Mock }[] = [];
    jest.spyOn(Animated, 'loop').mockImplementation(() => {
      const anim = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
      loops.push(anim);
      return anim;
    });
    await render(<StatusIcon kind="wash" state="washing" testID="s" />);
    await act(async () => undefined);
    // The first frame may start before the preference arrives; once it is known, nothing runs.
    expect(loops.every((l) => l.start.mock.calls.length === 0 || l.stop.mock.calls.length > 0)).toBe(true);
  });

  it('announces a change of state on iOS when asked', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const view = await render(<StatusIcon kind="ride" state="driver_assigned" announce testID="s" />);
    expect(announce).not.toHaveBeenCalled();
    await view.rerender(<StatusIcon kind="ride" state="driver_arrived" announce testID="s" />);
    expect(announce).toHaveBeenCalledWith('Chauffeuse arrivée');
  });
});

describe('StatusPill (deprecated wrapper)', () => {
  it('draws the tone glyph instead of a dot, keeping the old props', async () => {
    await render(<StatusPill tone="success" label="Préféré" testID="p" />);
    expect(screen.getByText('Préféré')).toBeTruthy();
    expect(iconName('p')).toBe('icon-CircleCheck');
  });

  it('draws the state glyph and short word when given a kind', async () => {
    await render(<StatusPill kind="support" state="awaiting_user" testID="p" />);
    expect(screen.getByText('Réponse attendue')).toBeTruthy();
    expect(screen.getByLabelText('Nous attendons votre réponse')).toBeTruthy();
    expect(iconName('p')).toBe('icon-MessageCircleQuestionMark');
  });

  it('keeps a caller’s word with the state glyph', async () => {
    await render(<StatusPill kind="scheduled" state="cancelled" label="Annulée" testID="p" />);
    expect(screen.getByText('Annulée')).toBeTruthy();
    expect(iconName('p')).toBe('icon-CalendarX');
  });
});

describe('StatusBanner', () => {
  it('keeps a title over the sentence for a problem', async () => {
    await render(<StatusBanner tone="danger" title="Paiement refusé" message="Contactez l’assistance." />);
    expect(screen.getByRole('alert', { name: 'Paiement refusé. Contactez l’assistance.' })).toBeTruthy();
    expect(screen.getByTestId('icon-CircleX', { includeHiddenElements: true })).toBeTruthy();
  });

  it('is one line with a glyph for information, each part still findable', async () => {
    await render(<StatusBanner tone="info" title="Aucun trajet aujourd’hui" message="Les trajets apparaîtront ici." />);
    expect(screen.getByText('Aucun trajet aujourd’hui')).toBeTruthy();
    expect(screen.getByText('Les trajets apparaîtront ici.')).toBeTruthy();
    expect(screen.getByTestId('icon-Info', { includeHiddenElements: true })).toBeTruthy();
  });

  it('never draws a clock for a warning', async () => {
    await render(<StatusBanner tone="warning" title="Hors ligne" />);
    expect(screen.getByTestId('icon-TriangleAlert', { includeHiddenElements: true })).toBeTruthy();
  });

  it('takes the glyph and tone of a state', async () => {
    await render(<StatusBanner kind="verification" state="more_info_requested" title="Complément demandé" message="Reprenez la photo du permis." />);
    expect(screen.getByTestId('icon-FileExclamationPoint', { includeHiddenElements: true })).toBeTruthy();
    expect(statusPresentation('verification', 'more_info_requested').tone).toBe('warning');
  });
});

describe('payment icons', () => {
  it('has one component per presentation icon, and the wallet for the chauffeuse’s wash payments', () => {
    expect(Object.keys(PAYMENT_ICONS).sort()).toEqual(['banknote', 'credit-card', 'smartphone', 'wallet']);
    expect(paymentMethodIcon({ kind: 'card', last4: '4242' })).toBe(PAYMENT_ICONS['credit-card']);
    expect(washPaymentIcon('driver_wallet')).toBe(PAYMENT_ICONS.wallet);
    expect(washPaymentIcon('cash')).toBe(PAYMENT_ICONS.banknote);
  });
});

it('every kind is renderable without a crash', async () => {
  for (const kind of STATUS_KINDS) {
    for (const state of STATUS_STATES[kind]) {
      const view = await render(<StatusIcon kind={kind} state={state as StatusStates[typeof kind]} showLabel testID="s" />);
      expect(screen.getByText(statusPresentation(kind, state as StatusStates[typeof kind]).shortLabel)).toBeTruthy();
      await view.unmount();
    }
  }
});
