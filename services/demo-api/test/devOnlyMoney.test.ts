import { describe, expect, it } from 'vitest';
import { mad } from '@naya/domain';
import { createApp } from '../src/app';
import { AGDAL_TRIP, PHONES, setup } from './harness';

type H = ReturnType<typeof setup>;

/**
 * The same store served as the API runs under NAYA_DEV=0. Routes are registered when the app is
 * created, so a second app over the harness store, with dev mode off, is the production shape.
 */
function withoutDevMode(h: H) {
  const app = createApp({ ...h.ctx, config: { ...h.ctx.config, devMode: false } });
  let n = 0;
  return async (path: string, token: string, body?: unknown) => {
    const res = await app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': `api03-${++n}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.status;
  };
}

/** A completed card ride whose payment the provider leaves pending (card ending 3155). */
async function pendingCardPayment(h: H) {
  const salma = await h.login(PHONES.salma, 'passenger');
  const amina = await h.login(PHONES.amina, 'driver');
  await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
  const quote = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
  const card = (await h.ok('GET', '/payment-methods', { token: salma })).find((m: any) => m.last4 === '3155');
  const ride = await h.ok('POST', '/rides', { token: salma, body: { quoteId: quote.id, paymentMethodId: card.id } });
  const offer = (await h.ok('GET', '/driver/status', { token: amina })).offer;
  await h.ok('POST', `/driver/offers/${offer.id}/accept`, { token: amina });
  await h.ok('POST', `/driver/rides/${ride.id}/arrive`, { token: amina });
  await h.ok('POST', `/driver/rides/${ride.id}/start`, { token: amina });
  const stops = (await h.ok('GET', `/rides/${ride.id}`, { token: amina })).ride.route.stops.length;
  for (let i = 0; i < stops - 2; i++) await h.ok('POST', `/driver/rides/${ride.id}/stop-complete`, { token: amina });
  await h.ok('POST', `/driver/rides/${ride.id}/complete`, { token: amina });
  h.advance(600);
  const payment = () => h.ok('GET', `/rides/${ride.id}`, { token: salma }).then((r: any) => r.payments[0]);
  expect((await payment()).status).toBe('pending');
  return { salma, payment };
}

describe('API-03 · a payer cannot settle her own money when dev mode is off', () => {
  it('provider sandbox: no route for a pending card payment with NAYA_DEV=0; dev mode still has it', async () => {
    const h = setup();
    const { salma, payment } = await pendingCardPayment(h);
    const { providerRef } = await payment();
    const post = withoutDevMode(h);
    expect(await post(`/provider-sandbox/payment/${providerRef}/approve`, salma)).toBe(404);
    expect(await post(`/provider-sandbox/payment/${providerRef}/decline`, salma)).toBe(404);
    expect(await post(`/dev/providers/payment/${providerRef}/confirm`, salma)).toBe(404);
    expect((await payment()).status).toBe('pending');
    // Under dev mode (tests, the mock stack) the same call settles it: the 404 comes from the mode.
    await h.ok('POST', `/provider-sandbox/payment/${providerRef}/approve`, { token: salma });
    expect((await payment()).status).toBe('confirmed');
  });

  it('provider sandbox: no route for a driver’s pending recharge with NAYA_DEV=0', async () => {
    const h = setup();
    const leila = await h.login(PHONES.leila, 'driver');
    const card = (await h.ok('GET', '/payment-providers?purpose=recharge', { token: leila })).find((p: any) => p.kind === 'card');
    const r = await h.ok('POST', '/driver/recharges', { token: leila, body: { amount: mad(50), providerId: card.id } });
    const post = withoutDevMode(h);
    expect(await post(`/provider-sandbox/recharge/${r.providerRef}/approve`, leila)).toBe(404);
    expect(await post(`/dev/providers/recharge/${r.providerRef}/confirm`, leila)).toBe(404);
    expect((await h.ok('GET', `/driver/recharges/${r.id}`, { token: leila })).status).toBe('pending');
    expect((await h.ok('GET', '/driver/wallet', { token: leila })).wallet.balance).toBe(-mad(150));
  });

  it('passenger wallet: no route to confirm her own top-up with NAYA_DEV=0', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const top = await h.ok('POST', '/prototype/wallet/topup', { token: salma, body: { amount: 20000, providerId: 'demo-mobile' } });
    const post = withoutDevMode(h);
    expect(await post(`/prototype/wallet/${top.id}/resolve`, salma, { outcome: 'confirmed' })).toBe(404);
    const wallet = await h.ok('GET', '/prototype/wallet', { token: salma });
    expect(wallet.balance).toBe(0);
    expect(wallet.entries.find((e: any) => e.id === top.id).status).toBe('pending');
  });
});
