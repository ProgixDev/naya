import { describe, expect, it } from 'vitest';
import { PLACES } from '@naya/domain';
import { PHONES, setup, JPEG_B64 } from './harness';

describe('feedback prototype workflows', () => {
  it('prices categories, freezes terms, and enforces admin category eligibility', async () => {
    const h = setup('first-ride');
    const p = await h.login(PHONES.salma, 'passenger');
    const d = await h.login(PHONES.amina, 'driver');
    const a = await h.adminLogin();
    const standard = await h.ok('POST', '/quotes', {
      token: p,
      body: {
        cityId: 'rabat',
        stops: [PLACES.gareRabatVille, PLACES.hayRiad],
        categoryId: 'standard',
      },
    });
    const premium = await h.ok('POST', '/quotes', {
      token: p,
      body: {
        cityId: 'rabat',
        stops: [PLACES.gareRabatVille, PLACES.hayRiad],
        categoryId: 'premium',
      },
    });
    expect(premium.breakdown.total).toBeGreaterThan(standard.breakdown.total);
    const catalog = await h.ok('GET', '/prototype/catalog', { token: p });
    await h.ok('PUT', '/admin/prototype/catalog/categories', {
      token: a,
      body: {
        ...catalog.categories.find((c: any) => c.id === 'premium'),
        perKm: 900,
      },
    });
    const me = await h.ok('GET', '/me', { token: d });
    await h.ok('POST', `/admin/prototype/driver-categories/${me.user.id}`, {
      token: a,
      body: { categoryIds: ['standard'] },
    });
    await h.ok('POST', '/driver/online', {
      token: d,
      body: { online: true, location: PLACES.gareRabatVille.location },
    });
    const methods = await h.ok('GET', '/payment-methods', { token: p });
    const ride = await h.ok('POST', '/rides', {
      token: p,
      body: {
        quoteId: premium.id,
        paymentMethodId: methods.find((m: any) => m.kind === 'cash').id,
      },
    });
    expect(ride.terms.breakdown.total).toBe(premium.breakdown.total);
    expect(ride.terms.service.id).toBe('premium');
    expect(
      h.ctx.store.state.offers.filter(
        (o) => o.rideId === ride.id && o.driverId === me.user.id,
      ),
    ).toHaveLength(0);
    await h.ok('PUT', '/admin/prototype/catalog/categories', {
      token: a,
      body: {
        ...catalog.categories.find((c: any) => c.id === 'premium'),
        enabled: false,
      },
    });
    const disabled = await h.call('POST', '/quotes', {
      token: p,
      body: {
        cityId: 'rabat',
        stops: [PLACES.gareRabatVille, PLACES.hayRiad],
        categoryId: 'premium',
      },
    });
    expect(disabled.status).toBe(404);
  });
  it('confirms topups once, prevents overspending, reserves and releases wallet funds', async () => {
    const h = setup('first-ride');
    const p = await h.login(PHONES.salma, 'passenger');
    const top = await h.ok('POST', '/prototype/wallet/topup', {
      token: p,
      key: 'top-once',
      body: { amount: 20000, providerId: 'demo-mobile' },
    });
    expect(
      (
        await h.ok('POST', '/prototype/wallet/topup', {
          token: p,
          key: 'top-once',
          body: { amount: 20000, providerId: 'demo-mobile' },
        })
      ).id,
    ).toBe(top.id);
    expect((await h.ok('GET', '/prototype/wallet', { token: p })).balance).toBe(
      0,
    );
    await h.ok('POST', `/prototype/wallet/${top.id}/resolve`, {
      token: p,
      body: { outcome: 'confirmed' },
    });
    await h.ok('POST', `/prototype/wallet/${top.id}/resolve`, {
      token: p,
      body: { outcome: 'confirmed' },
    });
    expect((await h.ok('GET', '/prototype/wallet', { token: p })).balance).toBe(
      20000,
    );
    const methods = await h.ok('GET', '/payment-methods', { token: p });
    const pm = methods.find((m: any) => m.kind === 'wallet');
    const quote = await h.ok('POST', '/quotes', {
      token: p,
      body: {
        cityId: 'rabat',
        stops: [PLACES.gareRabatVille, PLACES.hayRiad],
        categoryId: 'standard',
      },
    });
    const ride = await h.ok('POST', '/rides', {
      token: p,
      body: { quoteId: quote.id, paymentMethodId: pm.id },
    });
    expect(
      (await h.ok('GET', '/prototype/wallet', { token: p })).reserved,
    ).toBe(quote.breakdown.total);
    await h.ok('POST', `/rides/${ride.id}/cancel`, {
      token: p,
      body: { reasonCode: 'changed_mind' },
    });
    expect(
      (await h.ok('GET', '/prototype/wallet', { token: p })).reserved,
    ).toBe(0);
    const other = await h.login(PHONES.nour, 'passenger');
    expect(
      (
        await h.call('POST', `/prototype/wallet/${top.id}/resolve`, {
          token: other,
          body: { outcome: 'confirmed' },
        })
      ).status,
    ).toBe(404);
  });
  it('requires arrival proof, child identity and authorized handover, then recurs', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const d = await h.login(PHONES.amina, 'driver');
    const f = await h.ok('POST', '/prototype/family/example', { token: p });
    const t = f.trips[0];
    const advance = (body: unknown) =>
      h.call('POST', `/prototype/family/trips/${t.id}/advance`, {
        token: d,
        body,
      });
    expect(
      (await h.ok('GET', '/prototype/family', { token: d })).children[0]
        .firstName,
    ).toBe('Lina');
    expect((await advance({ expectedStatus: 'scheduled' })).status).toBe(200);
    expect((await advance({ expectedStatus: 'en_route' })).status).toBe(422);
    expect(
      (
        await advance({
          expectedStatus: 'en_route',
          proof: 'demo-arrival-photo',
        })
      ).status,
    ).toBe(200);
    expect(
      (await advance({ expectedStatus: 'arrived', childName: 'Wrong' })).status,
    ).toBe(422);
    expect(
      (await advance({ expectedStatus: 'arrived', childName: 'Lina' })).status,
    ).toBe(200);
    expect((await advance({ expectedStatus: 'picked_up' })).status).toBe(200);
    expect(
      (
        await advance({
          expectedStatus: 'in_progress',
          recipientId: 'mother',
          code: '9999',
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await advance({
          expectedStatus: 'in_progress',
          recipientId: 'mother',
          code: '1234',
        })
      ).status,
    ).toBe(200);
    const result = await h.ok('GET', '/prototype/family', { token: p });
    expect(result.trips).toHaveLength(2);
    expect(result.trips[0].timeline).toHaveLength(6);
    expect(result.trips[1].status).toBe('scheduled');
  });
  it('records SOS simulation actions, enforces ownership and supports admin resolution', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const other = await h.login(PHONES.nour, 'passenger');
    const a = await h.adminLogin();
    const f = await h.ok('POST', '/prototype/family/example', { token: p });
    const body = {
      familyTripId: f.trips[0].id,
      rideId: null,
      location: PLACES.hayRiad.location,
      contactName: 'Ma sœur',
    };
    expect(
      (await h.call('POST', '/prototype/sos', { token: other, body })).status,
    ).toBe(404);
    const alert = await h.ok('POST', '/prototype/sos', {
      token: p,
      key: 'sos-once',
      body,
    });
    expect(
      (
        await h.ok('POST', '/prototype/sos', {
          token: p,
          key: 'sos-once',
          body,
        })
      ).id,
    ).toBe(alert.id);
    await h.ok('POST', `/prototype/sos/${alert.id}/action`, {
      token: p,
      body: { action: 'Position partagée (simulation)' },
    });
    await h.ok('POST', `/admin/prototype/alerts/${alert.id}`, {
      token: a,
      body: { status: 'resolved', note: 'Test traité par le support' },
    });
    const data = await h.ok('GET', '/admin/prototype', { token: a });
    expect(data.alerts[0].status).toBe('resolved');
    expect(data.alerts[0].actions).toHaveLength(3);
  });
  it('validates dispute evidence and audits replies and rejected decisions', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const a = await h.adminLogin();
    const body = {
      rideId: null,
      reasonId: 'vehicle_problem',
      category: 'ride',
      subject: 'Problème de véhicule',
      body: 'La ceinture ne fonctionnait pas.',
      attachments: [],
    };
    expect(
      (await h.call('POST', '/support/tickets', { token: p, body })).status,
    ).toBe(422);
    const upload = await h.ok('POST', '/uploads', {
      token: p,
      body: {
        purpose: 'support_attachment',
        mimeType: 'image/jpeg',
        dataBase64: JPEG_B64,
        width: null,
        height: null,
      },
    });
    const ticket = await h.ok('POST', '/support/tickets', {
      token: p,
      body: { ...body, attachments: [upload.id] },
    });
    await h.ok('POST', `/admin/support/${ticket.id}/messages`, {
      token: a,
      body: { body: 'Nous examinons votre demande.', attachments: [] },
    });
    await h.ok('POST', `/admin/support/${ticket.id}/resolve`, {
      token: a,
      body: {
        outcome: 'rejected',
        note: 'Preuve insuffisante pour confirmer le problème.',
      },
    });
    expect(
      (await h.ok('GET', `/support/tickets/${ticket.id}`, { token: p })).status,
    ).toBe('rejected');
    expect(
      h.ctx.store.state.audit.some((e) => e.action === 'support.replied'),
    ).toBe(true);
  });
  it.each(['wallet', 'mobile_wallet'] as const)(
    'settles %s rides and credits driver net once',
    async (kind) => {
      const h = setup('first-ride');
      const p = await h.login(PHONES.salma, 'passenger');
      const d = await h.login(PHONES.amina, 'driver');
      if (kind === 'wallet') {
        const top = await h.ok('POST', '/prototype/wallet/topup', {
          token: p,
          body: { amount: 20000, providerId: 'demo-cashplus' },
        });
        await h.ok('POST', `/prototype/wallet/${top.id}/resolve`, {
          token: p,
          body: { outcome: 'confirmed' },
        });
      }
      await h.ok('POST', '/driver/online', {
        token: d,
        body: { online: true, location: PLACES.gareRabatVille.location },
      });
      const q = await h.ok('POST', '/quotes', {
        token: p,
        body: {
          cityId: 'rabat',
          stops: [PLACES.gareRabatVille, PLACES.hayRiad],
          categoryId: 'standard',
        },
      });
      const methods = await h.ok('GET', '/payment-methods', { token: p });
      const ride = await h.ok('POST', '/rides', {
        token: p,
        body: {
          quoteId: q.id,
          paymentMethodId: methods.find((m: any) => m.kind === kind).id,
        },
      });
      const status = await h.ok('GET', '/driver/status', { token: d });
      await h.ok('POST', `/driver/offers/${status.offer.id}/accept`, {
        token: d,
      });
      for (const step of ['arrive', 'start', 'complete'])
        await h.ok('POST', `/driver/rides/${ride.id}/${step}`, {
          token: d,
          key: `step-${step}`,
        });
      const detail = await h.ok('GET', `/rides/${ride.id}`, { token: p });
      expect(detail.payments[0].status).toBe('confirmed');
      expect(
        h.ctx.store.state.ledger.filter(
          (e) => e.rideId === ride.id && e.type === 'ride_net_credit',
        ),
      ).toHaveLength(1);
      const wallet = await h.ok('GET', '/prototype/wallet', { token: p });
      if (kind === 'wallet')
        expect(wallet.balance).toBe(20000 - q.breakdown.total);
      expect(wallet.reserved).toBe(0);
    },
  );
  it('releases wallet reservations when dispatch times out and reserves on retry', async () => {
    const h = setup('first-ride');
    const p = await h.login(PHONES.salma, 'passenger');
    const top = await h.ok('POST', '/prototype/wallet/topup', {
      token: p,
      body: { amount: 20000, providerId: 'demo-wafacash' },
    });
    await h.ok('POST', `/prototype/wallet/${top.id}/resolve`, {
      token: p,
      body: { outcome: 'confirmed' },
    });
    const q = await h.ok('POST', '/quotes', {
      token: p,
      body: { cityId: 'rabat', stops: [PLACES.gareRabatVille, PLACES.hayRiad] },
    });
    const methods = await h.ok('GET', '/payment-methods', { token: p });
    const ride = await h.ok('POST', '/rides', {
      token: p,
      body: {
        quoteId: q.id,
        paymentMethodId: methods.find((m: any) => m.kind === 'wallet').id,
      },
    });
    h.advance(180);
    expect(
      (await h.ok('GET', '/prototype/wallet', { token: p })).reserved,
    ).toBe(0);
    await h.ok('POST', `/rides/${ride.id}/retry-search`, { token: p });
    expect(
      (await h.ok('GET', '/prototype/wallet', { token: p })).reserved,
    ).toBe(q.breakdown.total);
  });
});
