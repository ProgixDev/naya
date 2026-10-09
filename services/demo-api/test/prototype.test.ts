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
  it('lists an estimate for every available category, including ones added by an admin', async () => {
    const h = setup('first-ride');
    const p = await h.login(PHONES.salma, 'passenger');
    const a = await h.adminLogin();
    const body = {
      cityId: 'rabat',
      stops: [PLACES.gareRabatVille, PLACES.hayRiad],
      categoryId: 'scooter',
    };
    const scooter = await h.ok('POST', '/quotes', { token: p, body });
    expect(scooter.options.map((o: any) => o.id)).toEqual(['scooter', 'standard', 'premium']);
    expect(scooter.options.find((o: any) => o.id === 'scooter').total).toBe(scooter.breakdown.total);
    expect(scooter.service.conditions).toContain('Casque fourni');
    await h.ok('PUT', '/admin/prototype/catalog/categories', {
      token: a,
      body: {
        id: 'van',
        name: 'Naya Van',
        description: 'Pour les groupes',
        icon: 'car',
        enabled: true,
        cityIds: ['rabat'],
        etaMinutes: 9,
        commissionBp: 2000,
        baseFare: 2500,
        perKm: 700,
        perMinute: 300,
        minimumFare: 6000,
        conditions: ['Jusqu’à 7 passagères'],
      },
    });
    const van = await h.ok('POST', '/quotes', { token: p, body: { ...body, categoryId: 'van' } });
    expect(van.service).toMatchObject({ id: 'van', commissionBp: 2000, conditions: ['Jusqu’à 7 passagères'] });
    expect(van.breakdown.total).toBeGreaterThanOrEqual(6000);
    expect(van.options.map((o: any) => o.id)).toContain('van');
    const bad = await h.call('PUT', '/admin/prototype/catalog/categories', {
      token: a,
      body: { ...van.service, id: 'Van X', name: 'X', description: 'X', enabled: true, cityIds: [], baseFare: null, perKm: null, perMinute: null, minimumFare: null },
    });
    expect(bad.status).toBe(422);
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
    expect(result.trips[1].kind).toBe('home_school');
    const done = result.trips[0];
    expect(Object.keys(done.times)).toEqual(['scheduled', 'en_route', 'arrived', 'picked_up', 'in_progress', 'completed']);
    expect(done.vehicle.plate).toBeTruthy();
    expect(done.recipientId).toBe('mother');
    expect(done.notifications.at(-1).title).toMatch(/remis·e à .*\(Mère\)/);
  });
  it('keeps several authorized people per child and never sends handover codes to the driver', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const d = await h.login(PHONES.amina, 'driver');
    const f = await h.ok('POST', '/prototype/family/example', { token: p });
    const child = f.children[0];
    const photo = await h.ok('POST', '/uploads', {
      token: p,
      body: { purpose: 'support_attachment', mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: 10, height: 10 },
    });
    const updated = await h.ok('PUT', `/prototype/family/children/${child.id}`, {
      token: p,
      body: {
        ...child,
        id: undefined,
        passengerId: undefined,
        photo: photo.id,
        recipients: [
          ...child.recipients,
          { id: 'grandma', name: 'Fatima', relationship: 'Grand-parent', phone: '0600000000', verificationCode: '4321' },
        ],
      },
    });
    expect(updated.recipients.map((r: any) => r.relationship)).toEqual(['Mère', 'Père', 'Grand-parent']);
    const seen = await h.ok('GET', '/prototype/family', { token: d });
    expect(seen.children[0].recipients.every((r: any) => r.verificationCode === '')).toBe(true);
    expect(seen.children[0].photo).toBe(photo.id);
    // The dedicated driver can open the child photo; another passenger cannot.
    expect((await h.call('GET', `/uploads/${photo.id}`, { token: d })).status).toBe(200);
    const other = await h.login(PHONES.nour, 'passenger');
    expect((await h.call('GET', `/uploads/${photo.id}`, { token: other })).status).toBe(403);
  });
  it('tracks the vehicle live and alerts the parent of delays and unusual stops', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const d = await h.login(PHONES.amina, 'driver');
    const f = await h.ok('POST', '/prototype/family/example', { token: p });
    const t = f.trips[0];
    const step = (body: unknown) => h.ok('POST', `/prototype/family/trips/${t.id}/advance`, { token: d, body });
    // Pickup planned in 1 h: still not there 5 min later → automatic alert.
    h.advance(3600 + 6 * 60);
    let trip = (await h.ok('GET', '/prototype/family', { token: p })).trips[0];
    expect(trip.incidents.map((x: any) => x.source)).toEqual(['auto']);
    expect(trip.notifications.at(-1).title).toMatch(/Retard/);
    h.advance(60);
    trip = (await h.ok('GET', '/prototype/family', { token: p })).trips[0];
    expect(trip.incidents).toHaveLength(1);
    await step({ expectedStatus: 'scheduled' });
    await step({ expectedStatus: 'en_route', proof: 'demo-arrival-photo' });
    await step({ expectedStatus: 'arrived', childName: 'lina' });
    await step({ expectedStatus: 'picked_up' });
    const start = (await h.ok('GET', '/prototype/family', { token: p })).trips[0].location;
    h.advance(10);
    const moved = (await h.ok('GET', '/prototype/family', { token: p })).trips[0].location;
    expect(moved).not.toEqual(start);
    await h.ok('POST', `/prototype/family/trips/${t.id}/stop`, { token: d, body: { stopped: true } });
    h.advance(10);
    trip = (await h.ok('GET', '/prototype/family', { token: p })).trips[0];
    expect(trip.incidents.at(-1).message).toMatch(/Arrêt inhabituel/);
    const frozen = trip.location;
    h.advance(5);
    expect((await h.ok('GET', '/prototype/family', { token: p })).trips[0].location).toEqual(frozen);
    await h.ok('POST', `/prototype/family/trips/${t.id}/stop`, { token: d, body: { stopped: false } });
    h.advance(5);
    expect((await h.ok('GET', '/prototype/family', { token: p })).trips[0].location).not.toEqual(frozen);
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
      body: { action: 'share_location' },
    });
    await h.ok('POST', `/admin/prototype/alerts/${alert.id}`, {
      token: a,
      body: { status: 'resolved', note: 'Test traité par le support' },
    });
    const data = await h.ok('GET', '/admin/prototype', { token: a });
    expect(data.alerts[0].status).toBe('resolved');
    expect(data.alerts[0].actions).toHaveLength(3);
    expect(data.alerts[0].actions[1].label).toBe('Position partagée depuis le téléphone');
  });
  it('records passenger, driver, vehicle, position and one support ticket for a ride SOS', async () => {
    const h = setup('first-ride');
    const p = await h.login(PHONES.salma, 'passenger');
    const d = await h.login(PHONES.amina, 'driver');
    const a = await h.adminLogin();
    await h.ok('POST', '/driver/online', { token: d, body: { online: true, location: PLACES.gareRabatVille.location } });
    const quote = await h.ok('POST', '/quotes', { token: p, body: { cityId: 'rabat', stops: [PLACES.gareRabatVille, PLACES.hayRiad] } });
    const methods = await h.ok('GET', '/payment-methods', { token: p });
    const ride = await h.ok('POST', '/rides', { token: p, body: { quoteId: quote.id, paymentMethodId: methods.find((m: any) => m.kind === 'cash').id } });
    const status = await h.ok('GET', '/driver/status', { token: d });
    await h.ok('POST', `/driver/offers/${status.offer.id}/accept`, { token: d });
    const where = { lat: 33.99, lng: -6.85 };
    const alert = await h.ok('POST', '/prototype/sos', {
      token: p,
      key: 'ride-sos',
      body: { rideId: ride.id, familyTripId: null, location: where, contactName: 'Ma sœur', contactPhone: '0600000000', note: 'Itinéraire inhabituel' },
    });
    expect(alert).toMatchObject({
      rideId: ride.id,
      passengerName: 'Salma El Mansouri',
      driverId: status.offer.driverId,
      location: where,
      status: 'new',
      note: 'Itinéraire inhabituel',
    });
    expect(alert.driverName).toMatch(/Amina/);
    expect(alert.vehiclePlate).toBeTruthy();
    const once = await h.ok('POST', `/prototype/sos/${alert.id}/action`, { token: p, body: { action: 'support' } });
    expect(once.ticketId).toBeTruthy();
    const twice = await h.ok('POST', `/prototype/sos/${alert.id}/action`, { token: p, body: { action: 'support' } });
    expect(twice.ticketId).toBe(once.ticketId);
    const tickets = await h.ok('GET', '/support/tickets', { token: p });
    expect(tickets.filter((t: any) => t.category === 'safety' && t.rideId === ride.id)).toHaveLength(1);
    expect((await h.call('POST', `/prototype/sos/${alert.id}/action`, { token: d, body: { action: 'support' } })).status).toBe(404);
    const admin = await h.ok('GET', '/admin/prototype', { token: a });
    expect(admin.alerts.find((x: any) => x.id === alert.id).passengerName).toBe('Salma El Mansouri');
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
      h.ctx.store.state.audit.some((e) => e.action === 'support.info_requested'),
    ).toBe(true);
  });
  it('runs a dispute through analysis, information request, logged actions and decision', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const d = await h.login(PHONES.amina, 'driver');
    const a = await h.adminLogin();
    const ride = h.ctx.store.state.rides.find((r) => r.passengerId === h.ctx.store.state.users.find((u) => u.phone === PHONES.salma)!.id && r.status === 'completed')!;
    // Reasons are filtered by role: a driver cannot report « Problème avec la chauffeuse ».
    const asDriver = await h.call('POST', '/support/tickets', {
      token: d,
      body: { rideId: null, reasonId: 'driver_behavior', category: 'ride', subject: 'Test', body: 'Ceci ne doit pas passer.', attachments: [] },
    });
    expect(asDriver.status).toBe(422);
    const t = await h.ok('POST', '/support/tickets', {
      token: p,
      body: { rideId: ride.id, reasonId: 'wrong_billing', category: 'payment', subject: 'Course incorrectement facturée', body: 'On m’a facturé un arrêt que je n’ai pas fait.', attachments: [] },
    });
    expect(t).toMatchObject({ status: 'open', isDispute: true });
    await h.ok('POST', `/admin/support/${t.id}/status`, { token: a, body: { status: 'in_progress' } });
    await h.ok('POST', `/admin/support/${t.id}/messages`, { token: a, body: { body: 'Pouvez-vous envoyer une capture du reçu ?', requestInfo: true } });
    expect((await h.ok('GET', `/support/tickets/${t.id}`, { token: p })).status).toBe('awaiting_user');
    const shot = await h.ok('POST', '/uploads', { token: p, body: { purpose: 'support_attachment', mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: null, height: null } });
    await h.ok('POST', `/support/tickets/${t.id}/messages`, { token: p, body: { body: 'Voici la capture.', attachments: [shot.id] } });
    await h.ok('POST', `/admin/support/${t.id}/actions`, { token: a, body: { kind: 'internal_note', label: 'Trajet GPS vérifié', note: 'Pas d’arrêt intermédiaire.' } });
    await h.ok('POST', `/admin/support/${t.id}/actions`, { token: a, body: { kind: 'action', label: 'Remboursement de 15 MAD accordé' } });
    await h.ok('POST', `/admin/support/${t.id}/resolve`, { token: a, body: { outcome: 'Remboursement accordé', note: 'Arrêt facturé à tort, montant remboursé.', decision: 'resolved' } });
    const detail = await h.ok('GET', `/admin/support/${t.id}`, { token: a });
    expect(detail.reason.label).toBe('Course incorrectement facturée');
    expect(detail.ride.id).toBe(ride.id);
    expect(detail.ticket.resolution).toMatchObject({ decision: 'resolved', outcome: 'Remboursement accordé' });
    expect(detail.ticket.history.map((x: any) => x.kind)).toEqual([
      'opened', 'status', 'info_requested', 'status', 'user_reply', 'status', 'internal_note', 'action', 'decision', 'status',
    ]);
    expect(detail.ticket.history.filter((x: any) => x.kind === 'status').map((x: any) => x.to)).toEqual(['in_progress', 'awaiting_user', 'in_progress', 'resolved']);
    // Every admin step is in the audit log.
    expect(detail.audit.map((e: any) => e.action)).toEqual(['support.analysis_started', 'support.info_requested', 'support.internal_note', 'support.action', 'support.resolved']);
    // The person never sees internal notes or internal actions.
    const mine = await h.ok('GET', `/support/tickets/${t.id}`, { token: p });
    expect(mine.history.some((x: any) => x.kind === 'internal_note' || x.kind === 'action')).toBe(false);
    expect(mine.status).toBe('resolved');
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
