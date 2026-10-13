import { describe, expect, it } from 'vitest';
import { AGDAL_TRIP, PHONES, setup } from './harness';

type H = ReturnType<typeof setup>;

const GPS = { lat: 34.0101, lng: -6.8402 };

async function acceptRide(h: H, passenger: string, driver: string) {
  const quote = await h.ok('POST', '/quotes', { token: passenger, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
  const cash = (await h.ok('GET', '/payment-methods', { token: passenger })).find((m: any) => m.kind === 'cash');
  const ride = await h.ok('POST', '/rides', { token: passenger, body: { quoteId: quote.id, paymentMethodId: cash.id } });
  const offer = (await h.ok('GET', '/driver/status', { token: driver })).offer;
  await h.ok('POST', `/driver/offers/${offer.id}/accept`, { token: driver });
  return ride as { id: string };
}

const presenceOf = async (h: H, driver: string) => (await h.ok('GET', '/driver/status', { token: driver })).presence;

describe('Driver location · shared only while online or on an accepted ride (P4)', () => {
  it('refuses positions from an offline driver with no ride and leaves the stored position untouched', async () => {
    const h = setup('first-ride');
    const amina = await h.login(PHONES.amina, 'driver');
    const before = await presenceOf(h, amina);
    expect(before.online).toBe(false);
    const r = await h.call('POST', '/driver/location', { token: amina, body: { location: GPS } });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('INVALID_TRANSITION');
    expect(r.body.error.details).toEqual({ reason: 'offline_without_ride' });
    expect((await presenceOf(h, amina)).location).toEqual(before.location);
  });

  it('refuses a driver who has never been online', async () => {
    const h = setup('first-ride');
    const khadija = await h.login(PHONES.khadija, 'driver');
    expect((await h.call('POST', '/driver/location', { token: khadija, body: { location: GPS } })).status).toBe(409);
  });

  it('refuses passengers and unauthenticated calls', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    expect((await h.call('POST', '/driver/location', { token: salma, body: { location: GPS } })).status).toBe(403);
    expect((await h.call('POST', '/driver/location', { body: { location: GPS } })).status).toBe(401);
  });

  it('accepts the idle heartbeat of an online driver, flagged as not on a ride', async () => {
    const h = setup('first-ride');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    expect(await h.ok('POST', '/driver/location', { token: amina, body: { location: GPS, heading: 90 } })).toEqual({ ok: true, onRide: false });
    const p = await presenceOf(h, amina);
    expect([p.location, p.locationSource]).toEqual([GPS, 'gps']);
    // Going offline ends sharing.
    await h.ok('POST', '/driver/online', { token: amina, body: { online: false } });
    expect((await h.call('POST', '/driver/location', { token: amina, body: { location: GPS } })).status).toBe(409);
  });

  it('accepts positions during an accepted ride, even if presence was switched offline, until the ride is completed', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const ride = await acceptRide(h, salma, amina);
    expect(await h.ok('POST', '/driver/location', { token: amina, body: { location: GPS } })).toEqual({ ok: true, onRide: true });
    await h.ok('POST', `/driver/rides/${ride.id}/arrive`, { token: amina });
    await h.ok('POST', `/driver/rides/${ride.id}/start`, { token: amina });
    h.ctx.store.tx((s) => {
      s.presence.find((p) => p.driverId === s.rides.find((r) => r.id === ride.id)!.driverId)!.online = false;
    });
    expect(await h.ok('POST', '/driver/location', { token: amina, body: { location: GPS } })).toEqual({ ok: true, onRide: true });
    // The ride ends (AGDAL_TRIP has one intermediate stop): a background task still running is refused.
    await h.ok('POST', `/driver/rides/${ride.id}/stop-complete`, { token: amina });
    expect((await h.ok('POST', `/driver/rides/${ride.id}/complete`, { token: amina })).status).toBe('completed');
    expect((await h.call('POST', '/driver/location', { token: amina, body: { location: GPS } })).status).toBe(409);
  });

  it('reports the end of the ride so a background task stops, then refuses once offline', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const ride = await acceptRide(h, salma, amina);
    expect((await h.ok('POST', '/driver/location', { token: amina, body: { location: GPS } })).onRide).toBe(true);
    // The passenger cancels while the driver's phone is locked.
    await h.ok('POST', `/rides/${ride.id}/cancel`, { token: salma, body: { reasonCode: 'changed_plans', acknowledgedFee: 0 } });
    expect(await h.ok('POST', '/driver/location', { token: amina, body: { location: GPS } })).toEqual({ ok: true, onRide: false });
    await h.ok('POST', '/driver/online', { token: amina, body: { online: false } });
    expect((await h.call('POST', '/driver/location', { token: amina, body: { location: GPS } })).body.error.code).toBe('INVALID_TRANSITION');
  });
});
