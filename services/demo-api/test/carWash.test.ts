import { describe, expect, it } from 'vitest';
import { casablancaLocalToUtc, mad, PLACES, RABAT_RULES, toCasablancaParts } from '@naya/domain';
import { PHONES, setup, START } from './harness';

type H = ReturnType<typeof setup>;

const CAR = { make: 'Dacia', model: 'Sandero', color: 'Gris perle', plate: '12345-A-6' };
const TOMORROW = toCasablancaParts(new Date(Date.parse(START) + 86_400_000).toISOString()).date;

function order(overrides: Record<string, unknown> = {}) {
  return {
    cityId: 'rabat',
    location: PLACES.agdal,
    parkingNotes: 'Parking résidence, sous-sol −1, place 42',
    car: CAR,
    vehicleId: null,
    packageId: 'interior_exterior',
    expectedPrice: mad(110),
    timing: 'now',
    startAt: null,
    ...overrides,
  };
}

async function optionsOf(h: H, token: string) {
  return h.ok<any[]>('GET', '/car-wash/payment-options?cityId=rabat', { token });
}

describe('car wash (« Lavage à domicile »)', () => {
  it('passenger: books now by card, the demo team is assigned, travels, washes, photographs and gets paid', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const catalog = await h.ok('GET', '/car-wash/catalog?cityId=rabat', { token: salma });
    expect(catalog.available).toBe(true);
    expect(catalog.placeholder).toBe(true);
    expect(catalog.packages.map((p: any) => p.id)).toEqual(['exterior', 'interior_exterior', 'complete']);
    const card = (await optionsOf(h, salma)).find((o) => o.label.includes('4242'));
    const created = await h.ok('POST', '/car-wash/orders', { token: salma, body: order({ paymentMethodId: card.id }) });
    expect(created).toMatchObject({ status: 'booked', customerRole: 'passenger', terms: { price: mad(110), durationMinutes: 75, rulesVersion: 1 }, simulated: true });
    expect(created.id).toMatch(/^LV-/);

    h.advance(15);
    let o = (await h.ok('GET', `/car-wash/orders/${created.id}`, { token: salma })).order;
    expect(o.status).toBe('washer_assigned');
    expect(o.team.name).toMatch(/^Équipe Lavage/);

    h.advance(10);
    o = (await h.ok('GET', `/car-wash/orders/${created.id}`, { token: salma })).order;
    expect(o.status).toBe('en_route');
    const first = o.teamLocation;
    expect(first.etaMinutes).toBeGreaterThan(1);
    h.clock.advance(30);
    o = (await h.ok('GET', `/car-wash/orders/${created.id}`, { token: salma })).order;
    // The team moves towards the car while en route.
    const dist = (p: any) => Math.hypot(p.lat - PLACES.agdal.location.lat, p.lng - PLACES.agdal.location.lng);
    expect(dist(o.teamLocation.location)).toBeLessThan(dist(first.location));

    h.advance(30);
    o = (await h.ok('GET', `/car-wash/orders/${created.id}`, { token: salma })).order;
    expect(o.status).toBe('washing');
    expect(o.photos.filter((p: any) => p.stage === 'before')).toHaveLength(2);

    // 75 minutes play 20× faster in the demo: 225 s.
    h.advance(225);
    const detail = await h.ok('GET', `/car-wash/orders/${created.id}`, { token: salma });
    expect(detail.order.status).toBe('completed');
    expect(detail.order.photos.filter((p: any) => p.stage === 'after')).toHaveLength(2);
    expect(detail.order.teamLocation).toBeNull();
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]).toMatchObject({ purpose: 'car_wash', method: 'card', amount: mad(110), status: 'pending' });
    h.advance(3);
    const paid = await h.ok('GET', `/car-wash/orders/${created.id}`, { token: salma });
    expect(paid.payments[0].status).toBe('confirmed');
    expect(paid.order.timeline.map((t: any) => t.type)).toEqual(['booked', 'assigned', 'departed', 'started', 'completed', 'payment.pending', 'payment.confirmed']);
    // No driver ledger is touched by a passenger's wash.
    expect(h.ctx.store.state.ledger.some((e) => e.description.includes(created.id))).toBe(false);

    const rated = await h.ok('POST', `/car-wash/orders/${created.id}/rating`, { token: salma, body: { stars: 5, comment: 'Impeccable' } });
    expect(rated.rating.stars).toBe(5);
    expect((await h.call('POST', `/car-wash/orders/${created.id}/rating`, { token: salma, body: { stars: 4, comment: null } })).status).toBe(409);
    expect((await h.call('POST', `/car-wash/orders/${created.id}/cancel`, { token: salma, body: { reasonCode: 'changed_plans' } })).status).toBe(409);
  });

  it('prices on the server: refuses a stale price, an unknown package, an out-of-zone car and a missing idempotency key', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const cash = (await optionsOf(h, salma)).find((o) => o.kind === 'cash');
    const stale = await h.call('POST', '/car-wash/orders', { token: salma, body: order({ paymentMethodId: cash.id, expectedPrice: mad(100) }) });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.price).toBe(mad(110));
    expect((await h.call('POST', '/car-wash/orders', { token: salma, body: order({ paymentMethodId: cash.id, packageId: 'gold' }) })).status).toBe(422);
    const far = { id: null, label: 'Kénitra', address: 'Kénitra', location: { lat: 34.26, lng: -6.58 } };
    expect((await h.call('POST', '/car-wash/orders', { token: salma, body: order({ paymentMethodId: cash.id, location: far }) })).body.error.code).toBe('OUT_OF_ZONE');
    expect((await h.call('POST', '/car-wash/orders', { token: salma, key: false, body: order({ paymentMethodId: cash.id }) })).status).toBe(422);
  });

  it('replays the same booking for the same idempotency key', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const cash = (await optionsOf(h, salma)).find((o) => o.kind === 'cash');
    const a = await h.ok('POST', '/car-wash/orders', { token: salma, key: 'wash-1', body: order({ paymentMethodId: cash.id }) });
    const b = await h.ok('POST', '/car-wash/orders', { token: salma, key: 'wash-1', body: order({ paymentMethodId: cash.id }) });
    expect(b.id).toBe(a.id);
    expect((await h.ok('GET', '/car-wash/orders', { token: salma })).length).toBe(1);
  });

  it('refuses passengers whose identity is not approved', async () => {
    const h = setup('first-ride');
    const nour = await h.login(PHONES.nour, 'passenger');
    const cash = (await optionsOf(h, nour)).find((o) => o.kind === 'cash');
    expect((await h.call('POST', '/car-wash/orders', { token: nour, body: order({ paymentMethodId: cash.id }) })).body.error.code).toBe('VERIFICATION_REQUIRED');
  });

  it('scheduled: validates the slot, waits for it, and cancellation fees follow the frozen rules', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const cash = (await optionsOf(h, salma)).find((o) => o.kind === 'cash');
    const offSlot = await h.call('POST', '/car-wash/orders', { token: salma, body: order({ paymentMethodId: cash.id, timing: 'scheduled', startAt: casablancaLocalToUtc(TOMORROW, '10:10') }) });
    expect(offSlot.status).toBe(422);
    const startAt = casablancaLocalToUtc(TOMORROW, '10:00');
    const booked = await h.ok('POST', '/car-wash/orders', { token: salma, body: order({ paymentMethodId: cash.id, timing: 'scheduled', startAt, packageId: 'exterior', expectedPrice: mad(60) }) });
    expect(booked.endAt).toBe(new Date(Date.parse(startAt) + 45 * 60_000).toISOString());
    h.advance(20);
    let o = (await h.ok('GET', `/car-wash/orders/${booked.id}`, { token: salma })).order;
    expect(o.status).toBe('washer_assigned');
    // Free until 2 h before the slot.
    expect((await h.ok('GET', `/car-wash/orders/${booked.id}/cancellation-preview`, { token: salma })).fee).toBe(0);
    // An hour before the slot, the team stays assigned and has not left yet; a late cancellation costs 20 MAD.
    h.clock.advance((Date.parse(startAt) - h.clock.now()) / 1000 - 3600);
    h.advance(0);
    o = (await h.ok('GET', `/car-wash/orders/${booked.id}`, { token: salma })).order;
    expect(o.status).toBe('washer_assigned');
    const preview = await h.ok('GET', `/car-wash/orders/${booked.id}/cancellation-preview`, { token: salma });
    expect(preview).toMatchObject({ fee: mad(20), reason: 'late' });
    expect((await h.call('POST', `/car-wash/orders/${booked.id}/cancel`, { token: salma, body: { reasonCode: 'wrong_time' } })).status).toBe(422);
    expect((await h.call('POST', `/car-wash/orders/${booked.id}/cancel`, { token: salma, body: { reasonCode: 'wrong_time', acknowledgedFee: 0 } })).status).toBe(409);
    const cancelled = await h.ok('POST', `/car-wash/orders/${booked.id}/cancel`, { token: salma, body: { reasonCode: 'wrong_time', acknowledgedFee: mad(20) } });
    expect(cancelled).toMatchObject({ status: 'cancelled', cancellation: { by: 'customer', fee: mad(20), reasonText: 'Le créneau ne me convient plus' } });
    const detail = await h.ok('GET', `/car-wash/orders/${booked.id}`, { token: salma });
    expect(detail.payments).toEqual([expect.objectContaining({ purpose: 'car_wash_fee', amount: mad(20), method: 'cash' })]);
    // The engine never moves a cancelled order.
    h.advance(7200);
    expect((await h.ok('GET', `/car-wash/orders/${booked.id}`, { token: salma })).order.status).toBe('cancelled');
  });

  it('passenger wallet: holds the price at booking and releases it on a free cancellation', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const top = await h.ok('POST', '/prototype/wallet/topup', { token: salma, body: { amount: mad(200), providerId: 'demo-mobile' } });
    await h.ok('POST', `/prototype/wallet/${top.id}/resolve`, { token: salma, body: { outcome: 'confirmed' } });
    const wallet = (await optionsOf(h, salma)).find((o) => o.kind === 'wallet');
    expect(wallet.available).toBe(true);
    const booked = await h.ok('POST', '/car-wash/orders', { token: salma, body: order({ paymentMethodId: wallet.id }) });
    let w = await h.ok('GET', '/prototype/wallet', { token: salma });
    expect(w.balance - w.reserved).toBe(mad(90));
    await h.ok('POST', `/car-wash/orders/${booked.id}/cancel`, { token: salma, body: { reasonCode: 'changed_plans' } });
    w = await h.ok('GET', '/prototype/wallet', { token: salma });
    expect(w.balance - w.reserved).toBe(mad(200));
  });

  it('driver: prefills her Naya vehicle, pays from her wallet ledger and is refunded minus the fee', async () => {
    const h = setup('default');
    const amina = await h.login(PHONES.amina, 'driver');
    const me = await h.ok('GET', '/me', { token: amina });
    expect(me.vehicle.plate).toBe('DÉMO-001');
    const options = await optionsOf(h, amina);
    expect(options.map((o: any) => o.kind)).toEqual(['driver_wallet', 'cash']);
    const walletOpt = options[0];
    // 70 MAD available: the complete package (180 MAD) is refused, the exterior one (60 MAD) goes through.
    const tooMuch = await h.call('POST', '/car-wash/orders', { token: amina, body: order({ paymentMethodId: walletOpt.id, packageId: 'complete', expectedPrice: mad(180), vehicleId: me.vehicle.id, car: { make: me.vehicle.make, model: me.vehicle.model, color: me.vehicle.color, plate: me.vehicle.plate } }) });
    expect(tooMuch.body.error.code).toBe('INSUFFICIENT_AVAILABLE');
    const booked = await h.ok('POST', '/car-wash/orders', { token: amina, body: order({ paymentMethodId: walletOpt.id, packageId: 'exterior', expectedPrice: mad(60), vehicleId: me.vehicle.id, car: { make: me.vehicle.make, model: me.vehicle.model, color: me.vehicle.color, plate: me.vehicle.plate } }) });
    expect(booked).toMatchObject({ customerRole: 'driver', vehicleId: me.vehicle.id, paymentMethod: { kind: 'driver_wallet' } });
    let wallet = (await h.ok('GET', '/driver/wallet', { token: amina })).wallet;
    expect(wallet.balance).toBe(mad(10));
    // En route: 30 MAD fee, 30 MAD refunded.
    h.advance(15);
    h.advance(10);
    const preview = await h.ok('GET', `/car-wash/orders/${booked.id}/cancellation-preview`, { token: amina });
    expect(preview).toMatchObject({ reason: 'en_route', fee: mad(30) });
    await h.ok('POST', `/car-wash/orders/${booked.id}/cancel`, { token: amina, body: { reasonCode: 'car_moved', acknowledgedFee: mad(30) } });
    wallet = (await h.ok('GET', '/driver/wallet', { token: amina })).wallet;
    expect(wallet.balance).toBe(mad(40));
    const ledger = h.ctx.store.state.ledger.filter((e) => e.idempotencyKey.startsWith(`wash:${booked.id}`));
    expect(ledger.map((e) => [e.type, e.amount])).toEqual([
      ['car_wash', -mad(60)],
      ['car_wash_refund', mad(30)],
    ]);
    // A driver cannot attach another driver's vehicle.
    const other = h.ctx.store.state.vehicles.find((v) => v.driverId !== me.user.id)!;
    expect((await h.call('POST', '/car-wash/orders', { token: amina, body: order({ paymentMethodId: options[1].id, vehicleId: other.id }) })).status).toBe(404);
  });

  it('keeps orders private and lists them read-only for admins with rides.read', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    const cash = (await optionsOf(h, salma)).find((o) => o.kind === 'cash');
    const booked = await h.ok('POST', '/car-wash/orders', { token: salma, body: order({ paymentMethodId: cash.id }) });
    expect((await h.call('GET', `/car-wash/orders/${booked.id}`, { token: amina })).status).toBe(404);
    expect(await h.ok('GET', '/car-wash/orders', { token: amina })).toEqual([]);
    const youssra = await h.adminLogin('youssra@naya.demo', 'Naya-Support-2026');
    const rows = await h.ok('GET', '/admin/car-wash/orders?cityId=rabat', { token: youssra });
    expect(rows).toEqual([expect.objectContaining({ customerName: 'Salma El Mansouri', statusLabel: 'Réservé' })]);
    expect((await h.call('GET', '/admin/car-wash/orders', { token: salma })).status).toBe(403);
  });

  it('is not offered in a city without car-wash rules', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const admin = await h.adminLogin();
    await h.ok('POST', '/admin/cities', { token: admin, body: { id: 'tanger', name: 'Tanger', status: 'test', center: { lat: 35.7595, lng: -5.834 }, rules: RABAT_RULES, reason: 'Ouverture de Tanger en test' } });
    expect(await h.ok('GET', '/car-wash/catalog?cityId=tanger', { token: salma })).toMatchObject({ available: false, cityName: 'Tanger' });
    expect((await h.ok('GET', '/car-wash/catalog?cityId=casablanca', { token: salma })).available).toBe(true);
  });
});
