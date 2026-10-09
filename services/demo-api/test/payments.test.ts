import { describe, expect, it } from 'vitest';
import { PHONES, setup } from './harness';

const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('Moroccan payment providers and adapters', () => {
  it('offers the same recharge options to passengers and drivers, once each', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const d = await h.login(PHONES.amina, 'driver');
    const forPassenger = await h.ok('GET', '/payment-providers?purpose=recharge', { token: p });
    const forDriver = await h.ok('GET', '/payment-providers?purpose=recharge', { token: d });
    expect(ids(forPassenger)).toEqual(['rabat-recharge-card', 'rabat-recharge-mobile-wallet', 'rabat-recharge-mobile-payment', 'rabat-recharge-agency', 'rabat-recharge-wafacash']);
    expect(ids(forDriver)).toEqual(ids(forPassenger));
    expect(forPassenger.map((x: any) => [x.kind, x.flow, x.needsPhone])).toEqual([
      ['card', 'hosted_page', false],
      ['mobile_wallet', 'wallet_approval', true],
      ['mobile_payment', 'wallet_approval', true],
      ['cash_network', 'voucher', false],
      ['cash_network', 'voucher', false],
    ]);
    // Production slots stay hidden until credentials exist.
    expect(ids(forPassenger)).not.toContain('rabat-recharge-wallet-live');
  });

  it('runs a wallet approval: phone required, pending until the provider confirms', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const body = { amount: 15000, providerId: 'rabat-recharge-mobile-wallet' };
    expect((await h.call('POST', '/prototype/wallet/topup', { token: p, body })).status).toBe(422);
    expect((await h.call('POST', '/prototype/wallet/topup', { token: p, body: { ...body, payerPhone: '12345' } })).status).toBe(422);
    const e = await h.ok('POST', '/prototype/wallet/topup', { token: p, body: { ...body, payerPhone: '0612345678' } });
    expect(e).toMatchObject({ status: 'pending', flow: 'wallet_approval', payerPhone: '0612345678', providerRef: `demo_mw_${e.id}` });
    expect(e.instructions).toContain('0612345678');
    expect((await h.ok('GET', '/prototype/wallet', { token: p })).balance).toBe(0);
    await h.ok('POST', `/provider-sandbox/passenger_recharge/${e.providerRef}/approve`, { token: p });
    const w = await h.ok('GET', '/prototype/wallet', { token: p });
    expect(w.balance).toBe(15000);
    expect(w.entries.at(-1).label).toBe('Recharge Wallet marocain (démo) · confirmée');
  });

  it('gives a counter code that credits once paid and fails when it expires', async () => {
    const h = setup();
    const d = await h.login(PHONES.amina, 'driver');
    const before = (await h.ok('GET', '/driver/wallet', { token: d })).wallet.balance;
    const r = await h.ok('POST', '/driver/recharges', { token: d, body: { amount: 5000, providerId: 'rabat-recharge-wafacash' } });
    expect(r).toMatchObject({ flow: 'voucher', status: 'pending', providerName: 'Wafacash (démo)' });
    expect(r.voucherCode).toMatch(/^\d{4} \d{4}$/);
    expect(Date.parse(r.expiresAt) - Date.parse(r.createdAt)).toBe(48 * 3600_000);
    expect(r.instructions).toContain('Wafacash');
    h.advance(48 * 3600 + 1);
    const expired = await h.ok('GET', `/driver/recharges/${r.id}`, { token: d });
    expect(expired).toMatchObject({ status: 'failed', failureReason: 'Code expiré sans paiement en agence.' });
    expect((await h.ok('GET', '/driver/wallet', { token: d })).wallet.balance).toBe(before);
    // A code paid in time is credited, and the later expiry job does nothing.
    const r2 = await h.ok('POST', '/driver/recharges', { token: d, body: { amount: 5000, providerId: 'rabat-recharge-agency' } });
    await h.ok('POST', `/provider-sandbox/recharge/${r2.providerRef}/approve`, { token: d });
    h.advance(48 * 3600 + 1);
    expect((await h.ok('GET', `/driver/recharges/${r2.id}`, { token: d })).status).toBe('confirmed');
    expect((await h.ok('GET', '/driver/wallet', { token: d })).wallet.balance).toBe(before + 5000);
  });

  it('enforces provider limits and accepts signed provider callbacks for passenger recharges', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const tooLow = await h.call('POST', '/prototype/wallet/topup', { token: p, body: { amount: 1500, providerId: 'rabat-recharge-agency' } });
    expect(tooLow.status).toBe(422);
    expect(tooLow.body.error.message).toContain('Montant minimum');
    const e = await h.ok('POST', '/prototype/wallet/topup', { token: p, body: { amount: 3000, providerId: 'rabat-recharge-card' } });
    const event = { eventId: 'evt-psp-1', kind: 'passenger_recharge', ref: e.providerRef, outcome: 'confirmed', reason: null };
    expect((await h.call('POST', '/providers/psp/callback', { body: event, headers: { 'X-Naya-Signature': 'bad' }, key: false })).status).toBe(401);
    await h.ok('POST', '/providers/psp/callback', { body: event, headers: { 'X-Naya-Signature': h.sign(JSON.stringify(event)) }, key: false });
    // The same event delivered twice changes nothing.
    await h.ok('POST', '/providers/psp/callback', { body: event, headers: { 'X-Naya-Signature': h.sign(JSON.stringify(event)) }, key: false });
    expect((await h.ok('GET', '/prototype/wallet', { token: p })).balance).toBe(3000);
  });

  it('lets the back-office add a provider, restrict it, and swap the adapter behind it', async () => {
    const h = setup();
    const a = await h.adminLogin();
    const p = await h.login(PHONES.salma, 'passenger');
    const d = await h.login(PHONES.amina, 'driver');
    const adapters = await h.ok('GET', '/admin/payment-adapters', { token: a });
    expect(adapters.find((x: any) => x.id === 'live-mobile-wallet')).toMatchObject({ mode: 'live', configured: false });
    const created = await h.ok('POST', '/admin/providers', {
      token: a,
      body: { cityId: 'rabat', purpose: 'recharge', adapter: 'demo-mobile-payment', name: 'Paiement mobile chauffeuses', audiences: ['driver'], minAmount: 5000, maxAmount: 50000, instructions: null, reason: 'Nouveau partenaire pour les chauffeuses.' },
    });
    expect(created).toMatchObject({ id: 'rabat-recharge-paiement-mobile-chauffeuses', kind: 'mobile_payment', enabled: false, configured: true });
    await h.ok('POST', `/admin/providers/${created.id}`, { token: a, body: { enabled: true, reason: 'Ouverture du service aux chauffeuses.' } });
    expect(ids(await h.ok('GET', '/payment-providers?purpose=recharge', { token: d }))).toContain(created.id);
    expect(ids(await h.ok('GET', '/payment-providers?purpose=recharge', { token: p }))).not.toContain(created.id);
    expect((await h.call('POST', '/prototype/wallet/topup', { token: p, body: { amount: 6000, providerId: created.id, payerPhone: '0612345678' } })).status).toBe(409);
    // Swapping to a production adapter without credentials takes the provider offline, nothing else changes.
    const swapped = await h.ok('PUT', `/admin/providers/${created.id}`, {
      token: a,
      body: { name: 'Paiement mobile chauffeuses', adapter: 'live-mobile-wallet', audiences: ['driver'], minAmount: 5000, maxAmount: 50000, instructions: null, reason: 'Bascule vers le prestataire de production.' },
    });
    expect(swapped).toMatchObject({ adapter: 'live-mobile-wallet', mode: 'live', configured: false, enabled: false });
    expect(ids(await h.ok('GET', '/payment-providers?purpose=recharge', { token: d }))).not.toContain(created.id);
    expect(h.ctx.store.state.audit.some((x) => x.action === 'provider.adapter_changed' && x.entityId === created.id)).toBe(true);
    const bad = await h.call('PUT', `/admin/providers/${created.id}`, { token: a, body: { name: 'X', adapter: 'demo-bank-transfer', audiences: [], minAmount: null, maxAmount: null, instructions: null, reason: 'Adaptateur incompatible.' } });
    expect(bad.status).toBe(422);
  });

  it('migrates stores written before adapters and removes the duplicated demo providers', async () => {
    const h = setup();
    const d = await h.login(PHONES.amina, 'driver');
    const s = h.ctx.store.state;
    // Shape of a store from the previous version.
    s.providers = s.providers.filter((x) => !/mobile|wafacash/.test(x.id)).map(({ adapter: _a, ...x }) => x);
    s.providers.push({ id: 'rabat-demo-card-recharge', cityId: 'rabat', purpose: 'recharge', kind: 'card', name: 'Carte bancaire (démo)', enabled: true, mode: 'demo', configured: true });
    const list = await h.ok('GET', '/payment-providers?purpose=recharge', { token: d });
    expect(list.filter((x: any) => x.name === 'Carte bancaire (démo)')).toHaveLength(1);
    expect(ids(list)).toContain('rabat-recharge-mobile-wallet');
    expect(s.providers.every((x) => !!x.adapter)).toBe(true);
  });
});
