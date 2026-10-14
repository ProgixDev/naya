import { describe, expect, it } from 'vitest';
import {
  assertWashStartAllowed,
  CAR_WASH_DEMO_CONFIG,
  carWashRulesFor,
  casablancaLocalToUtc,
  createWashOrderSchema,
  isWashOpen,
  mad,
  priceWash,
  washCancellationPreview,
  washEndAt,
  washOrderMachine,
  washSlots,
  WASH_PROGRESS,
  type WashOrderStatus,
} from '../src';

const RABAT = carWashRulesFor('rabat')!;
// 1 Oct 2026, 08:00 UTC = 09:00 in Rabat (UTC+1 outside Ramadan).
const NOW = Date.parse('2026-10-01T08:00:00Z');

describe('wash order machine', () => {
  it('follows réservé → assignée → en route → lavage → terminé', () => {
    let s: WashOrderStatus = 'booked';
    const seen: WashOrderStatus[] = [s];
    for (const e of ['ASSIGN', 'DEPART', 'START', 'COMPLETE'] as const) {
      s = washOrderMachine.next(s, e);
      seen.push(s);
    }
    expect(seen).toEqual([...WASH_PROGRESS]);
  });
  it('lets the customer cancel until the wash starts, never after', () => {
    for (const s of ['booked', 'washer_assigned', 'en_route'] as const) expect(washOrderMachine.next(s, 'CUSTOMER_CANCEL')).toBe('cancelled');
    expect(() => washOrderMachine.next('washing', 'CUSTOMER_CANCEL')).toThrow();
    expect(() => washOrderMachine.next('completed', 'CUSTOMER_CANCEL')).toThrow();
  });
  it('rejects skipped steps and terminal moves', () => {
    expect(() => washOrderMachine.next('booked', 'START')).toThrow();
    expect(() => washOrderMachine.next('washer_assigned', 'COMPLETE')).toThrow();
    expect(() => washOrderMachine.next('en_route', 'ASSIGN')).toThrow();
    expect(washOrderMachine.events('completed')).toEqual([]);
    expect(washOrderMachine.events('cancelled')).toEqual([]);
  });
  it('knows which orders are open', () => {
    expect(isWashOpen('washing')).toBe(true);
    expect(isWashOpen('completed')).toBe(false);
    expect(isWashOpen('cancelled')).toBe(false);
  });
});

describe('wash pricing (demo configuration, placeholder values)', () => {
  it('is marked as placeholder and offered in Rabat and Casablanca only', () => {
    expect(CAR_WASH_DEMO_CONFIG.placeholder).toBe(true);
    expect(carWashRulesFor('rabat')).not.toBeNull();
    expect(carWashRulesFor('casablanca')).not.toBeNull();
    expect(carWashRulesFor('tanger')).toBeNull();
  });
  it('keeps every price in integer centimes, every package with a duration, and prices rising with the package', () => {
    for (const rules of Object.values(CAR_WASH_DEMO_CONFIG.cities)) {
      const prices = rules.packages.map((p) => p.price);
      for (const p of rules.packages) {
        expect(Number.isSafeInteger(p.price) && p.price > 0).toBe(true);
        expect(p.durationMinutes).toBeGreaterThan(0);
      }
      expect([...prices].sort((a, b) => a - b)).toEqual(prices);
      expect(rules.cancellation.lateFee).toBeLessThan(prices[0]!);
    }
  });
  it('prices a package and splits the commission exactly', () => {
    const p = priceWash(RABAT, 'interior_exterior');
    expect(p.price).toBe(mad(110));
    expect(p.durationMinutes).toBe(75);
    expect(p.commission).toBe(mad(22)); // 20 % placeholder commission
    expect(p.partnerNet + p.commission).toBe(p.price);
  });
  it('refuses a disabled or unknown package', () => {
    const rules = { ...RABAT, packages: RABAT.packages.map((p) => (p.id === 'complete' ? { ...p, enabled: false } : p)) };
    expect(() => priceWash(rules, 'complete')).toThrow(/indisponible/);
  });
  it('derives the end of the wash from its duration', () => {
    expect(washEndAt('2026-10-02T09:00:00.000Z', 75)).toBe('2026-10-02T10:15:00.000Z');
  });
});

describe('wash slots', () => {
  const s = RABAT.scheduling;
  it('offers 30-minute slots inside opening hours, ending before closing', () => {
    const slots = washSlots(s, 120, '2026-10-02', NOW);
    expect(slots[0]).toBe('08:00');
    expect(slots.at(-1)).toBe('18:00');
    expect(slots.every((t) => /^\d{2}:(00|30)$/.test(t))).toBe(true);
  });
  it('respects the lead time today', () => {
    // 09:00 in Rabat with a 60-minute lead: the first slot is 10:00.
    expect(washSlots(s, 45, '2026-10-01', NOW)[0]).toBe('10:00');
  });
  it('refuses starts that are too soon, too far, off-slot or after hours', () => {
    expect(() => assertWashStartAllowed(new Date(NOW + 30 * 60_000).toISOString(), s, 45, NOW)).toThrow(/à l’avance/);
    expect(() => assertWashStartAllowed(new Date(NOW + 8 * 86_400_000).toISOString(), s, 45, NOW)).toThrow(/7 jours/);
    expect(() => assertWashStartAllowed(casablancaLocalToUtc('2026-10-02', '10:15'), s, 45, NOW)).toThrow(/créneau proposé/);
    expect(() => assertWashStartAllowed(casablancaLocalToUtc('2026-10-02', '19:00'), s, 120, NOW)).toThrow(/créneau proposé/);
    expect(() => assertWashStartAllowed(casablancaLocalToUtc('2026-10-02', '06:30'), s, 45, NOW)).toThrow(/créneau proposé/);
    expect(() => assertWashStartAllowed(casablancaLocalToUtc('2026-10-02', '10:30'), s, 45, NOW)).not.toThrow();
  });
});

describe('wash cancellation rules', () => {
  const terms = { cancellation: RABAT.cancellation, price: mad(60) };
  const startAt = new Date(NOW + 4 * 3_600_000).toISOString();
  it('is free before a team is assigned', () => {
    expect(washCancellationPreview({ status: 'booked', assignedAt: null, startAt, terms }, NOW).fee).toBe(0);
  });
  it('is free until 2 h before the slot, then costs the late fee', () => {
    const assignedAt = new Date(NOW - 3_600_000).toISOString();
    const early = washCancellationPreview({ status: 'washer_assigned', assignedAt, startAt, terms }, NOW);
    expect(early).toMatchObject({ fee: 0, reason: 'before_cutoff' });
    const late = washCancellationPreview({ status: 'washer_assigned', assignedAt, startAt, terms }, NOW + 2.5 * 3_600_000);
    expect(late).toMatchObject({ fee: mad(20), reason: 'late' });
  });
  it('gives 5 free minutes after assignment for « Maintenant » orders', () => {
    const soon = new Date(NOW + 40 * 60_000).toISOString();
    const assignedAt = new Date(NOW).toISOString();
    expect(washCancellationPreview({ status: 'washer_assigned', assignedAt, startAt: soon, terms }, NOW + 60_000)).toMatchObject({ fee: 0, reason: 'within_grace' });
    expect(washCancellationPreview({ status: 'washer_assigned', assignedAt, startAt: soon, terms }, NOW + 6 * 60_000).fee).toBe(mad(20));
  });
  it('keeps the 5 free minutes when the « Maintenant » team has already left (CW-01)', () => {
    const soon = new Date(NOW + 40 * 60_000).toISOString();
    const assignedAt = new Date(NOW).toISOString();
    // The demo team leaves 10 s after assignment: still inside the free window the sheet announces.
    const enRoute = washCancellationPreview({ status: 'en_route', assignedAt, startAt: soon, terms }, NOW + 10_000);
    expect(enRoute).toMatchObject({ fee: 0, reason: 'within_grace', freeUntil: new Date(NOW + 5 * 60_000).toISOString() });
    expect(enRoute.explanation).toMatch(/en route, mais l’annulation reste gratuite pendant 5 minutes/);
    expect(washCancellationPreview({ status: 'en_route', assignedAt, startAt: soon, terms }, NOW + 5 * 60_000 - 1).fee).toBe(0);
    expect(washCancellationPreview({ status: 'en_route', assignedAt, startAt: soon, terms }, NOW + 5 * 60_000)).toMatchObject({ fee: mad(30), reason: 'en_route', freeUntil: null });
  });
  it('applies the same slot rule en route: free until 2 h before the slot', () => {
    const assignedAt = new Date(NOW - 3_600_000).toISOString();
    expect(washCancellationPreview({ status: 'en_route', assignedAt, startAt, terms }, NOW)).toMatchObject({ fee: 0, reason: 'before_cutoff' });
  });
  it('costs the en-route fee once the team has left after the free window, never more than the price', () => {
    const assignedAt = new Date(NOW - 3_600_000).toISOString();
    const leaving = Date.parse(startAt) - 60_000;
    expect(washCancellationPreview({ status: 'en_route', assignedAt, startAt, terms }, leaving)).toMatchObject({ fee: mad(30), reason: 'en_route' });
    expect(washCancellationPreview({ status: 'en_route', assignedAt, startAt, terms: { ...terms, price: mad(25) } }, leaving).fee).toBe(mad(25));
  });
  it('cannot be cancelled once washing', () => {
    expect(washCancellationPreview({ status: 'washing', assignedAt: null, startAt, terms }, NOW).reason).toBe('not_cancellable');
  });
});

describe('wash order input', () => {
  const base = {
    cityId: 'rabat',
    location: { id: null, label: 'Agdal', address: 'Avenue de France', location: { lat: 33.99, lng: -6.85 } },
    parkingNotes: 'Sous-sol −1, place 42',
    car: { make: 'Dacia', model: 'Logan', color: 'Gris', plate: '12345-A-6' },
    vehicleId: null,
    packageId: 'exterior',
    expectedPrice: 6000,
    paymentMethodId: 'PM-1',
  };
  it('needs a slot when scheduled', () => {
    expect(createWashOrderSchema.safeParse({ ...base, timing: 'scheduled', startAt: null }).success).toBe(false);
    expect(createWashOrderSchema.safeParse({ ...base, timing: 'now', startAt: null }).success).toBe(true);
  });
  it('refuses a float price and an empty plate', () => {
    expect(createWashOrderSchema.safeParse({ ...base, timing: 'now', startAt: null, expectedPrice: 60.5 }).success).toBe(false);
    expect(createWashOrderSchema.safeParse({ ...base, timing: 'now', startAt: null, car: { ...base.car, plate: '' } }).success).toBe(false);
  });
});
