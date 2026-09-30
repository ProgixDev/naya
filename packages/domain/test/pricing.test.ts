import { describe, expect, it } from 'vitest';
import { CASABLANCA_RULES, computeFare, demoRoute, mad, passengerCancellationPreview, PLACES, RABAT_RULES, splitFare } from '../src';

describe('pricing (configurable demo rules)', () => {
  it('Rabat 10 km / 25 min = 100 MAD', () => {
    expect(computeFare(RABAT_RULES, 10_000, 1500).total).toBe(mad(100));
  });
  it('Rabat with ×1,2 = 120 MAD, surcharge disclosed', () => {
    const f = computeFare(RABAT_RULES, 10_000, 1500, 12_000);
    expect(f.total).toBe(mad(120));
    expect(f.dynamicSurcharge).toBe(mad(20));
    expect(f.subtotal).toBe(mad(100));
  });
  it('Casablanca 10 km / 25 min = 107 MAD, ×1,2 = 128,40 MAD', () => {
    expect(computeFare(CASABLANCA_RULES, 10_000, 1500).total).toBe(mad(107));
    expect(computeFare(CASABLANCA_RULES, 10_000, 1500, 12_000).total).toBe(12_840);
  });
  it('applies the minimum fare before the multiplier', () => {
    const f = computeFare(RABAT_RULES, 1000, 120);
    expect(f.subtotal).toBe(mad(18));
    expect(f.minimumAdjustment).toBe(mad(12));
    expect(f.total).toBe(mad(30));
    expect(computeFare(RABAT_RULES, 1000, 120, 12_000).total).toBe(mad(36));
  });
  it('commission 15 % of 100 = 15, net 85', () => {
    expect(splitFare(mad(100), 1500)).toEqual({ gross: mad(100), commission: mad(15), net: mad(85) });
    expect(splitFare(mad(107), 1800)).toEqual({ gross: mad(107), commission: 1926, net: 8774 });
  });
  it('demo route Gare → Agdal → Hay Riad is exactly 10 km / 25 min', () => {
    const r = demoRoute([PLACES.gareRabatVille, PLACES.agdal, PLACES.hayRiad]);
    expect(r.distanceMeters).toBe(10_000);
    expect(r.durationSeconds).toBe(1500);
  });
});

describe('cancellation fee disclosure', () => {
  const policy = RABAT_RULES.cancellation;
  const t0 = Date.parse('2026-10-01T08:00:00Z');
  it('is free while searching', () => {
    expect(passengerCancellationPreview({ status: 'searching', assignedAt: null }, policy, t0).fee).toBe(0);
  });
  it('is free within the grace period after assignment', () => {
    const p = passengerCancellationPreview({ status: 'driver_assigned', assignedAt: new Date(t0).toISOString() }, policy, t0 + 60_000);
    expect(p.fee).toBe(0);
    expect(p.reason).toBe('within_grace');
  });
  it('charges after grace and after arrival', () => {
    expect(passengerCancellationPreview({ status: 'driver_assigned', assignedAt: new Date(t0).toISOString() }, policy, t0 + 121_000).fee).toBe(mad(10));
    expect(passengerCancellationPreview({ status: 'driver_arrived', assignedAt: new Date(t0).toISOString() }, policy, t0).fee).toBe(mad(15));
  });
});
