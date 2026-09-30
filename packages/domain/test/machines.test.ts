import { describe, expect, it } from 'vitest';
import {
  assertModifiable,
  assertOfferAcceptable,
  assertPickupTimeAllowed,
  assertSubmittable,
  isDriverVerified,
  offerMachine,
  offerRemainingSeconds,
  RABAT_RULES,
  resolveTransferEvent,
  rideMachine,
  scheduledMachine,
  verificationMachine,
} from '../src';

describe('ride machine', () => {
  it('follows the happy path', () => {
    let s = rideMachine.next('searching', 'ASSIGN');
    s = rideMachine.next(s, 'ARRIVE');
    s = rideMachine.next(s, 'START');
    expect(rideMachine.next(s, 'COMPLETE')).toBe('completed');
  });
  it('driver cancellation returns the ride to searching (recovery)', () => {
    expect(rideMachine.next('driver_assigned', 'DRIVER_CANCEL')).toBe('searching');
    expect(rideMachine.next('driver_arrived', 'DRIVER_CANCEL')).toBe('searching');
  });
  it('rejects illegal transitions', () => {
    expect(() => rideMachine.next('in_progress', 'PASSENGER_CANCEL')).toThrow();
    expect(() => rideMachine.next('completed', 'COMPLETE')).toThrow();
    expect(() => rideMachine.next('searching', 'START')).toThrow();
  });
});

describe('offer machine and deadline', () => {
  const created = Date.parse('2026-10-01T08:00:00Z');
  const offer = { status: 'pending' as const, expiresAt: new Date(created + 30_000).toISOString() };
  it('counts down against the authoritative deadline', () => {
    expect(offerRemainingSeconds(offer, created)).toBe(30);
    expect(offerRemainingSeconds(offer, created + 20_500)).toBe(10);
    expect(offerRemainingSeconds(offer, created + 31_000)).toBe(0);
  });
  it('rejects late acceptance', () => {
    expect(() => assertOfferAcceptable(offer, created + 29_999)).not.toThrow();
    expect(() => assertOfferAcceptable(offer, created + 30_000)).toThrow(/expiré/);
    expect(() => assertOfferAcceptable({ ...offer, status: 'withdrawn' }, created)).toThrow(/plus disponible/);
  });
  it('terminal states accept nothing', () => {
    for (const s of ['accepted', 'declined', 'expired', 'withdrawn'] as const) {
      expect(offerMachine.events(s)).toEqual([]);
    }
  });
});

describe('verification', () => {
  it('submission is not approval; correction loops back through submission', () => {
    expect(verificationMachine.next('draft', 'SUBMIT')).toBe('submitted');
    expect(verificationMachine.next('submitted', 'REQUEST_MORE')).toBe('more_info_requested');
    expect(verificationMachine.next('more_info_requested', 'RESUBMIT')).toBe('submitted');
    expect(() => verificationMachine.next('draft', 'APPROVE')).toThrow();
    expect(verificationMachine.next('rejected', 'REOPEN')).toBe('draft');
  });
  it('requires every piece before submission', () => {
    expect(() => assertSubmittable({ subject: 'passenger_identity', items: [], identity: null, vehicle: null })).toThrow();
  });
  it('driver needs both approvals', () => {
    expect(isDriverVerified('approved', 'submitted')).toBe(false);
    expect(isDriverVerified('approved', 'approved')).toBe(true);
  });
});

describe('transfers are idempotent', () => {
  it('duplicate confirmations are no-ops, contradictions conflict', () => {
    expect(resolveTransferEvent('pending', 'CONFIRM')).toEqual({ next: 'confirmed', outcome: 'applied' });
    expect(resolveTransferEvent('confirmed', 'CONFIRM')).toEqual({ next: 'confirmed', outcome: 'duplicate' });
    expect(() => resolveTransferEvent('confirmed', 'FAIL')).toThrow();
  });
});

describe('scheduling', () => {
  const now = Date.parse('2026-10-01T08:00:00Z');
  it('enforces lead time and horizon', () => {
    expect(() => assertPickupTimeAllowed(new Date(now + 10 * 60_000).toISOString(), RABAT_RULES.scheduling, now)).toThrow();
    expect(() => assertPickupTimeAllowed(new Date(now + 9 * 86_400_000).toISOString(), RABAT_RULES.scheduling, now)).toThrow();
    expect(() => assertPickupTimeAllowed(new Date(now + 2 * 3_600_000).toISOString(), RABAT_RULES.scheduling, now)).not.toThrow();
  });
  it('refuses modification inside the cutoff', () => {
    expect(() => assertModifiable({ status: 'scheduled', pickupAt: new Date(now + 30 * 60_000).toISOString() }, RABAT_RULES.scheduling, now)).toThrow();
    expect(scheduledMachine.next('scheduled', 'CANCEL')).toBe('cancelled');
  });
});
