import { describe, expect, it } from 'vitest';
import {
  assertFamilleEligible,
  assertFamilyStep,
  canReceiveFamilleTrips,
  DomainError,
  FAMILY_APPROVAL_TIMEOUT_SECONDS,
  FAMILY_DEMO_TIME_FACTOR,
  FAMILY_MAX_START_REQUESTS,
  familleEligibilityOf,
  familyDriverBase,
  familyLive,
  familyTripMachine,
  haversineMeters,
  newStartApproval,
  PLACES,
  type FamilyChild,
  type FamilyStepContext,
  type FamilyTrip,
} from '../src';

const T0 = Date.parse('2026-10-13T07:30:00Z');
const child: Pick<FamilyChild, 'firstName' | 'recipients'> = {
  firstName: 'Lina',
  recipients: [{ id: 'mother', name: 'Salma', relationship: 'Mère', verificationCode: '1234' }],
};
const proof = { uploadId: 'UP-1', at: new Date(T0).toISOString(), location: PLACES.hayRiad.location, simulated: false };

function trip(over: Partial<FamilyTrip> = {}): FamilyTrip {
  return {
    id: 'FT-001',
    passengerId: 'PA-001',
    childId: 'CH-001',
    childName: 'Lina',
    driverId: 'DR-001',
    driverName: 'Amina Bennani',
    pickup: PLACES.hayRiad,
    destination: PLACES.agdal,
    pickupAt: new Date(T0).toISOString(),
    weekdays: [],
    status: 'scheduled',
    location: PLACES.hayRiad.location,
    recipientId: null,
    arrivalProof: null,
    pickupVerified: false,
    timeline: [],
    notifications: [],
    incident: null,
    pickupPhoto: null,
    dropoffPhoto: null,
    approval: null,
    approvals: [],
    ...over,
  };
}
const ctx = (over: Partial<FamilyStepContext> = {}): FamilyStepContext => ({ nowMs: T0, actor: 'driver', child, position: null, input: {}, ...over });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof DomainError ? e.code : 'OTHER';
  }
  return null;
};

describe('Famille trip machine', () => {
  it('cannot start without passing through the parent’s approval', () => {
    expect(familyTripMachine.can('picked_up', 'APPROVE')).toBe(false);
    expect(familyTripMachine.events('picked_up')).not.toContain('DROPOFF');
    expect(Object.values(familyTripMachine.table.picked_up)).not.toContain('in_progress');
    expect(familyTripMachine.next('picked_up', 'REQUEST_START')).toBe('awaiting_approval');
    expect(familyTripMachine.next('awaiting_approval', 'APPROVE')).toBe('in_progress');
  });
  it('a refusal or a timeout keeps the child at the pick-up point', () => {
    expect(familyTripMachine.next('awaiting_approval', 'REFUSE')).toBe('picked_up');
    expect(familyTripMachine.next('awaiting_approval', 'EXPIRE')).toBe('picked_up');
    expect(familyTripMachine.can('picked_up', 'REQUEST_START')).toBe(true);
  });
  it('closes only through the drop-off, and closed trips accept nothing', () => {
    expect(familyTripMachine.next('in_progress', 'DROPOFF')).toBe('completed');
    expect(familyTripMachine.can('in_progress', 'CANCEL')).toBe(false);
    expect(familyTripMachine.can('awaiting_approval', 'CANCEL')).toBe(false);
    expect(familyTripMachine.events('completed')).toEqual([]);
    expect(familyTripMachine.events('cancelled')).toEqual([]);
  });
});

describe('Famille guards', () => {
  it('requires the pick-up photo of the child before « Démarrer »', () => {
    expect(code(() => assertFamilyStep(trip({ status: 'arrived' }), 'PICKUP', ctx({ input: { childName: 'Lina' } })))).toBe('FAMILY_PROOF_REQUIRED');
    expect(code(() => assertFamilyStep(trip({ status: 'arrived' }), 'PICKUP', ctx({ input: { proof: 'UP-1', childName: 'Nour' } })))).toBe('VALIDATION');
    expect(assertFamilyStep(trip({ status: 'arrived' }), 'PICKUP', ctx({ input: { proof: 'UP-1', childName: 'lina' } }))).toBe('picked_up');
    expect(code(() => assertFamilyStep(trip({ status: 'picked_up', pickupPhoto: null }), 'REQUEST_START', ctx()))).toBe('FAMILY_PROOF_REQUIRED');
    expect(assertFamilyStep(trip({ status: 'picked_up', pickupPhoto: proof }), 'REQUEST_START', ctx())).toBe('awaiting_approval');
  });

  it('only the parent approves, and only before the deadline', () => {
    const approval = newStartApproval('FA-001', T0);
    const waiting = trip({ status: 'awaiting_approval', pickupPhoto: proof, approval, approvals: [approval] });
    expect(code(() => assertFamilyStep(waiting, 'APPROVE', ctx({ actor: 'driver', input: { approvalId: 'FA-001' } })))).toBe('FORBIDDEN');
    expect(code(() => assertFamilyStep(waiting, 'APPROVE', ctx({ actor: 'parent', input: { approvalId: 'FA-000' } })))).toBe('CONFLICT');
    expect(code(() => assertFamilyStep(waiting, 'APPROVE', ctx({ actor: 'parent', nowMs: T0 + FAMILY_APPROVAL_TIMEOUT_SECONDS * 1000, input: { approvalId: 'FA-001' } })))).toBe('FAMILY_APPROVAL_EXPIRED');
    expect(assertFamilyStep(waiting, 'APPROVE', ctx({ actor: 'parent', nowMs: T0 + 30_000, input: { approvalId: 'FA-001' } }))).toBe('in_progress');
    expect(assertFamilyStep(waiting, 'REFUSE', ctx({ actor: 'parent', input: { approvalId: 'FA-001' } }))).toBe('picked_up');
  });

  it('expiry is the server’s, after the deadline only', () => {
    const approval = newStartApproval('FA-001', T0);
    const waiting = trip({ status: 'awaiting_approval', approval, approvals: [approval] });
    expect(code(() => assertFamilyStep(waiting, 'EXPIRE', ctx({ actor: 'parent' })))).toBe('FORBIDDEN');
    expect(code(() => assertFamilyStep(waiting, 'EXPIRE', ctx({ actor: 'system', nowMs: T0 + 1000 })))).toBe('INVALID_TRANSITION');
    expect(assertFamilyStep(waiting, 'EXPIRE', ctx({ actor: 'system', nowMs: T0 + FAMILY_APPROVAL_TIMEOUT_SECONDS * 1000 }))).toBe('picked_up');
  });

  it('caps repeated start requests', () => {
    const refused = Array.from({ length: FAMILY_MAX_START_REQUESTS }, (_, i) => ({ ...newStartApproval(`FA-${i}`, T0), status: 'refused' as const }));
    expect(code(() => assertFamilyStep(trip({ status: 'picked_up', pickupPhoto: proof, approvals: refused }), 'REQUEST_START', ctx()))).toBe('FAMILY_APPROVAL_REQUIRED');
  });

  it('closes only with the drop-off photo on the school premises and the handover code', () => {
    const riding = trip({ status: 'in_progress', pickupPhoto: proof });
    const atSchool = PLACES.agdal.location;
    expect(code(() => assertFamilyStep(riding, 'DROPOFF', ctx({ position: atSchool, input: { recipientId: 'mother', code: '1234' } })))).toBe('FAMILY_PROOF_REQUIRED');
    expect(code(() => assertFamilyStep(riding, 'DROPOFF', ctx({ position: PLACES.hayRiad.location, input: { proof: 'UP-2', recipientId: 'mother', code: '1234' } })))).toBe('VALIDATION');
    expect(code(() => assertFamilyStep(riding, 'DROPOFF', ctx({ position: atSchool, input: { proof: 'UP-2', recipientId: 'mother', code: '9999' } })))).toBe('VALIDATION');
    expect(code(() => assertFamilyStep(riding, 'DROPOFF', ctx({ position: atSchool, input: { proof: 'UP-2', recipientId: 'mother' } })))).toBe('VALIDATION');
    expect(assertFamilyStep(riding, 'DROPOFF', ctx({ position: atSchool, input: { proof: 'UP-2', recipientId: 'mother', code: '1234' } }))).toBe('completed');
    // « when set »: no recipient code on the profile, the photo alone closes the trip.
    expect(assertFamilyStep(riding, 'DROPOFF', ctx({ child: { firstName: 'Lina', recipients: [] }, position: atSchool, input: { proof: 'UP-2' } }))).toBe('completed');
  });

  it('a parent cannot play the chauffeuse’s steps through the guard', () => {
    expect(code(() => assertFamilyStep(trip(), 'DEPART', ctx({ actor: 'parent' })))).toBe('FORBIDDEN');
    expect(code(() => assertFamilyStep(trip(), 'CANCEL', ctx({ actor: 'parent', input: { reason: ' ' } })))).toBe('REASON_REQUIRED');
    expect(assertFamilyStep(trip(), 'CANCEL', ctx({ actor: 'parent', input: { reason: 'Malade' } }))).toBe('cancelled');
  });
});

describe('Famille eligibility gate', () => {
  const driver = (familleEligibility?: 'not_requested' | 'pending' | 'approved' | 'rejected', status: 'active' | 'suspended' = 'active') => ({ role: 'driver' as const, status, familleEligibility });
  it('reads a missing flag as not_requested', () => {
    expect(familleEligibilityOf(driver(undefined))).toBe('not_requested');
    expect(familleEligibilityOf({ role: 'passenger', familleEligibility: 'approved' })).toBe('not_requested');
  });
  it('lets only approved, active chauffeuses receive Famille trips', () => {
    expect(canReceiveFamilleTrips(driver('approved'))).toBe(true);
    for (const v of ['not_requested', 'pending', 'rejected', undefined] as const) {
      expect(canReceiveFamilleTrips(driver(v))).toBe(false);
      expect(code(() => assertFamilleEligible(driver(v)))).toBe('FAMILLE_NOT_ELIGIBLE');
    }
    expect(canReceiveFamilleTrips(driver('approved', 'suspended'))).toBe(false);
  });
});

describe('Famille live position (demo engine)', () => {
  const wall = (routeSeconds: number) => (routeSeconds * 1000) / FAMILY_DEMO_TIME_FACTOR;
  it('drives from the chauffeuse’s base to the pick-up, then waits there', () => {
    const t = trip({ status: 'en_route', departedAt: new Date(T0).toISOString() });
    const start = familyLive(t, T0);
    expect(start.leg).toBe('to_pickup');
    expect(haversineMeters(start.location, familyDriverBase(PLACES.hayRiad.location))).toBeLessThan(5);
    const later = familyLive(t, T0 + 3000);
    expect(later.progress).toBeGreaterThan(start.progress);
    expect(later.etaSeconds!).toBeLessThan(start.etaSeconds!);
    expect(haversineMeters(familyLive(t, T0 + 3_600_000).location, PLACES.hayRiad.location)).toBeLessThan(5);
    const waiting = familyLive(trip({ status: 'awaiting_approval' }), T0);
    expect(waiting.leg).toBe('at_pickup');
    expect(waiting.etaSeconds).toBeNull();
  });
  it('moves every second along Hay Riad → Agdal and arrives', () => {
    const t = trip({ status: 'in_progress', startedAt: new Date(T0).toISOString() });
    const a = familyLive(t, T0 + 1000);
    const b = familyLive(t, T0 + 2000);
    expect(haversineMeters(a.location, b.location)).toBeGreaterThan(10);
    expect(familyLive(t, T0 + wall(1020)).leg).toBe('arrived');
    expect(familyLive(t, T0 + wall(1020)).remainingMeters).toBe(0);
  });
  it('a fresh device fix wins over the simulation; a stale one does not', () => {
    const fix = { location: { lat: 33.98, lng: -6.86 }, at: new Date(T0).toISOString() };
    const t = trip({ status: 'in_progress', startedAt: new Date(T0).toISOString(), lastFix: fix });
    expect(familyLive(t, T0 + 2000)).toMatchObject({ source: 'gps', location: fix.location, ageSeconds: 2 });
    expect(familyLive(t, T0 + 10_000).source).toBe('demo');
  });
  it('reports the seconds left on a pending approval', () => {
    const approval = newStartApproval('FA-001', T0);
    expect(familyLive(trip({ status: 'awaiting_approval', approval }), T0 + 60_000).approval?.secondsLeft).toBe(FAMILY_APPROVAL_TIMEOUT_SECONDS - 60);
  });
});
