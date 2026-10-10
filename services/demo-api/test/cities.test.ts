import { describe, expect, it } from 'vitest';
import { mad } from '@naya/domain';
import { PHONES, setup } from './harness';

const MARRAKECH = { lat: 31.6295, lng: -7.9811 };
const rules = {
  baseFare: mad(9), perKm: mad(3.5), perMinute: mad(1.5), minimumFare: mad(25), commissionBp: 1500, debtLimit: mad(150),
  cancellation: { graceSeconds: 180, feeAfterGrace: mad(8), feeAfterArrival: mad(12) },
  dynamic: { enabled: false, multiplierBp: 12000, reason: 'Forte demande à Marrakech.' },
  offerTimeoutSeconds: 30, searchTimeoutSeconds: 120, quoteValiditySeconds: 600,
  scheduling: { minLeadMinutes: 30, maxDaysAhead: 7, modifyCutoffMinutes: 60 }, minimumWithdrawal: mad(20),
};

describe('a city added from the back-office works without code changes', () => {
  it('Marrakech: zone, places, map position, categories, payment providers and quotes', async () => {
    const h = setup();
    const a = await h.adminLogin();
    await h.ok('POST', '/admin/cities', { token: a, body: { id: 'marrakech', name: 'Marrakech', status: 'test', center: MARRAKECH, rules, reason: 'Ouverture pilote à Marrakech.' } });
    await h.ok('POST', '/admin/cities/marrakech/zones', {
      token: a,
      body: { name: 'Marrakech · centre', polygon: [{ lat: 31.68, lng: -8.05 }, { lat: 31.68, lng: -7.92 }, { lat: 31.58, lng: -7.92 }, { lat: 31.58, lng: -8.05 }], active: true, reason: 'Zone pilote du centre.' },
    });
    await h.ok('POST', '/admin/cities/marrakech/status', { token: a, body: { status: 'active', reason: 'Lancement public à Marrakech.' } });

    const p = await h.login(PHONES.salma, 'passenger');
    // Search proposes places around the configured centre, inside the zone.
    const places = await h.ok('GET', '/places/search?q=&cityId=marrakech', { token: p });
    expect(places.length).toBeGreaterThan(2);
    expect(places.every((x: any) => x.label.startsWith('Marrakech'))).toBe(true);
    // A point on the map is named after Marrakech, not after a Rabat landmark.
    const pin = await h.ok('GET', `/places/reverse?lat=${MARRAKECH.lat + 0.01}&lng=${MARRAKECH.lng}`, { token: p });
    expect(pin.label).toBe('Marrakech · point sur la carte');
    // Quotes use the city's own rules and every category available in all cities.
    const q = await h.ok('POST', '/quotes', { token: p, body: { cityId: 'marrakech', stops: [places[0], places[3]], categoryId: 'standard' } });
    expect(q.cityId).toBe('marrakech');
    expect(q.breakdown.total).toBe(mad(25)); // short demo leg: city minimum fare
    expect(q.conditions.cancellation.graceSeconds).toBe(180);
    expect(q.options.map((o: any) => o.id)).toEqual(['scooter', 'standard', 'premium']);
    // The city starts with the default provider set, disabled until the team enables it.
    const providers = await h.ok('GET', '/admin/providers?cityId=marrakech', { token: a });
    expect(providers.map((x: any) => x.kind)).toEqual(expect.arrayContaining(['card', 'mobile_wallet', 'mobile_payment', 'cash_network', 'bank_transfer']));
    expect(providers.every((x: any) => !x.enabled)).toBe(true);
  });
});
