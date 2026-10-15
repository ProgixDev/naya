import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_STATUS_LABELS,
  FAMILLE_ELIGIBILITY_VALUES,
  FAMILY_STATUS_LABELS,
  FAMILY_STATUS_SHORT_LABELS,
  OFFER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  RIDE_STATUS_LABELS,
  SAFETY_STATUS_LABELS,
  SCHEDULED_STATUS_LABELS,
  STATUS_GLYPHS,
  STATUS_KINDS,
  STATUS_LABELS,
  STATUS_STATES,
  SUPPORT_STATUS_LABELS,
  TONE_GLYPHS,
  TRANSFER_STATUS_LABELS,
  WASH_STATUS_LABELS,
  statusA11y,
  statusPresentation,
  walletEntryStatus,
  type StatusKind,
  type StatusStates,
} from '../src';

/** Each covered enum, from the maps the screens already use, so a new state cannot slip past the table. */
const ENUMS: { [K in StatusKind]?: readonly string[] } = {
  ride: Object.keys(RIDE_STATUS_LABELS),
  offer: [...Object.keys(OFFER_STATUS_LABELS), 'taken'],
  payment: Object.keys(PAYMENT_STATUS_LABELS),
  transfer: Object.keys(TRANSFER_STATUS_LABELS),
  scheduled: Object.keys(SCHEDULED_STATUS_LABELS),
  support: Object.keys(SUPPORT_STATUS_LABELS),
  verification: Object.keys(STATUS_LABELS),
  document: Object.keys(DOCUMENT_STATUS_LABELS),
  verificationItem: ['missing', 'provided', 'accepted', 'needs_correction'],
  familleEligibility: FAMILLE_ELIGIBILITY_VALUES,
  familyTrip: Object.keys(FAMILY_STATUS_LABELS),
  familyApproval: ['pending', 'approved', 'refused', 'expired'],
  guardian: ['invited', 'active', 'revoked'],
  familleSubscription: ['active', 'paused'],
  wash: Object.keys(WASH_STATUS_LABELS),
  safetyAlert: Object.keys(SAFETY_STATUS_LABELS),
  walletDebit: ['pending', 'confirmed', 'failed'],
  walletCredit: ['pending', 'pending_agency', 'confirmed', 'failed'],
  city: ['active', 'test', 'inactive'],
};

const present = <K extends StatusKind>(kind: K, state: string) => statusPresentation(kind, state as StatusStates[K]);

describe('statusPresentation', () => {
  it('covers every state of every enum, and nothing else', () => {
    for (const [kind, states] of Object.entries(ENUMS) as [StatusKind, string[]][]) {
      expect([...STATUS_STATES[kind]].sort(), kind).toEqual([...states].sort());
    }
  });

  it('gives each state a glyph, a tone, a word of at most 18 characters and a sentence', () => {
    for (const kind of STATUS_KINDS) {
      for (const state of STATUS_STATES[kind]) {
        const p = present(kind, state);
        const where = `${kind}.${state}`;
        expect(STATUS_GLYPHS, where).toContain(p.glyph);
        expect(['accent', 'info', 'success', 'warning', 'danger', 'neutral'], where).toContain(p.tone);
        expect(p.shortLabel.length, where).toBeGreaterThan(0);
        expect(p.shortLabel.length, `${where} « ${p.shortLabel} »`).toBeLessThanOrEqual(18);
        expect(p.label.length, where).toBeGreaterThan(0);
        expect(typeof p.problem, where).toBe('boolean');
      }
    }
  });

  it('never lets two states of one kind share a glyph (colour is never the only cue)', () => {
    for (const kind of STATUS_KINDS) {
      const glyphs = STATUS_STATES[kind].map((s) => present(kind, s).glyph);
      expect(new Set(glyphs).size, `${kind}: ${glyphs.join(', ')}`).toBe(glyphs.length);
    }
  });

  it('keeps one meaning per glyph: Clock is never a state, ArrowUpRight is retired', () => {
    const all = STATUS_KINDS.flatMap((k) => STATUS_STATES[k].map((s) => present(k, s).glyph));
    expect(all).not.toContain('clock');
    expect(all).not.toContain('arrow-up-right');
    // Done is CircleCheck, a verified person BadgeCheck; cancelled by someone is CircleSlash, never a failure tone.
    for (const kind of STATUS_KINDS) {
      for (const state of STATUS_STATES[kind]) {
        const p = present(kind, state);
        if (p.glyph === 'circle-slash') expect(p.tone, `${kind}.${state}`).toBe('neutral');
        if (p.tone === 'danger' && kind !== 'safetyAlert') expect(p.problem, `${kind}.${state}`).toBe(true);
      }
    }
  });

  it('applies the tone rules of §2.3 (R3, R5)', () => {
    expect(present('ride', 'cancelled').tone).toBe('neutral');
    expect(present('scheduled', 'cancelled').tone).toBe('neutral');
    expect(present('payment', 'pending').tone).toBe('info');
    expect(present('verification', 'in_review').tone).toBe('info');
    expect(present('familleEligibility', 'pending').tone).toBe('info');
    expect(present('wash', 'washing').tone).toBe('accent');
    expect(present('familyTrip', 'en_route').tone).toBe('accent');
    expect(present('familyTrip', 'awaiting_approval')).toMatchObject({ tone: 'warning', problem: true });
  });

  it('marks the problem states, which always keep their word', () => {
    const problems = STATUS_KINDS.flatMap((k) => STATUS_STATES[k].filter((s) => present(k, s).problem).map((s) => `${k}.${s}`));
    expect(problems).toEqual(
      expect.arrayContaining([
        'ride.no_driver',
        'payment.failed',
        'transfer.failed',
        'scheduled.expired',
        'support.awaiting_user',
        'support.rejected',
        'verification.more_info_requested',
        'verification.rejected',
        'document.rejected',
        'verificationItem.needs_correction',
        'familleEligibility.rejected',
        'familyTrip.awaiting_approval',
        'familyApproval.refused',
        'walletCredit.failed',
        'driverAvailability.blocked',
        'account.suspended',
      ]),
    );
    expect(problems).not.toContain('ride.cancelled');
    expect(problems).not.toContain('walletDebit.failed');
  });

  it('animates only searching, online, washing and loading', () => {
    const moving = STATUS_KINDS.flatMap((k) => STATUS_STATES[k].filter((s) => present(k, s).motion).map((s) => `${k}.${s}:${present(k, s).motion}`));
    expect(moving.sort()).toEqual(['driverAvailability.online:pulse-slow', 'progress.loading:spin', 'ride.searching:pulse', 'wash.washing:breathe']);
  });

  it('uses the short Famille words in chips and keeps the long sentence for the screen reader', () => {
    expect(present('familyTrip', 'awaiting_approval').shortLabel).toBe(FAMILY_STATUS_SHORT_LABELS.awaiting_approval);
    expect(FAMILY_STATUS_LABELS.awaiting_approval.length).toBeGreaterThan(18);
    expect(statusPresentation('familyTrip', 'awaiting_approval', { viewer: 'driver' })).toMatchObject({ shortLabel: 'Accord du parent', label: 'Accord du parent attendu', tone: 'warning' });
  });

  it('says a released wallet debit took nothing (R11)', () => {
    expect(present('walletDebit', 'failed')).toMatchObject({ glyph: 'lock-open', tone: 'neutral', label: 'Montant libéré · rien n’a été débité' });
  });

  it('falls back to a neutral glyph for an unknown state instead of throwing', () => {
    expect(present('ride', 'teleported')).toEqual({ glyph: 'circle-dashed', tone: 'neutral', shortLabel: 'teleported', label: 'teleported', problem: false });
  });
});

describe('statusA11y', () => {
  it('reads as a clause after a row title', () => {
    expect(`Permis de conduire, ${statusA11y('document', 'in_review')}`).toBe('Permis de conduire, pièce en vérification');
    expect(statusA11y('ride', 'no_driver')).toBe('aucune chauffeuse disponible');
  });
});

describe('walletEntryStatus', () => {
  it('splits debits and credits, and agency top-ups', () => {
    expect(walletEntryStatus({ amount: -2500, status: 'pending' })).toEqual({ kind: 'walletDebit', state: 'pending' });
    expect(walletEntryStatus({ amount: 10000, status: 'pending' }, true)).toEqual({ kind: 'walletCredit', state: 'pending_agency' });
    expect(walletEntryStatus({ amount: 10000, status: 'pending' })).toEqual({ kind: 'walletCredit', state: 'pending' });
    expect(walletEntryStatus({ amount: 10000, status: 'confirmed' }, true)).toEqual({ kind: 'walletCredit', state: 'confirmed' });
  });
});

describe('TONE_GLYPHS', () => {
  it('never draws a clock for a tone, and warning is a triangle', () => {
    expect(TONE_GLYPHS.warning).toBe('triangle-alert');
    expect(Object.values(TONE_GLYPHS)).not.toContain('clock');
  });
});
