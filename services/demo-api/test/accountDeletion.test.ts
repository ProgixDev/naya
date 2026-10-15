import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyAuditChain } from '../src/audit';
import { AGDAL_TRIP, PHONES, setup } from './harness';

type H = ReturnType<typeof setup>;

const userByPhone = (h: H, phone: string) => h.ctx.store.state.users.find((u) => u.phone === phone && u.role === 'passenger')!;

/** A completed card ride whose payment the provider leaves pending (card ending 3155). */
async function completedRide(h: H, salma: string, last4: string) {
  const amina = await h.login(PHONES.amina, 'driver');
  await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
  const quote = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
  const card = (await h.ok('GET', '/payment-methods', { token: salma })).find((m: any) => m.last4 === last4);
  const ride = await h.ok('POST', '/rides', { token: salma, body: { quoteId: quote.id, paymentMethodId: card.id } });
  const offer = (await h.ok('GET', '/driver/status', { token: amina })).offer;
  await h.ok('POST', `/driver/offers/${offer.id}/accept`, { token: amina });
  await h.ok('POST', `/driver/rides/${ride.id}/arrive`, { token: amina });
  await h.ok('POST', `/driver/rides/${ride.id}/start`, { token: amina });
  const stops = (await h.ok('GET', `/rides/${ride.id}`, { token: amina })).ride.route.stops.length;
  for (let i = 0; i < stops - 2; i++) await h.ok('POST', `/driver/rides/${ride.id}/stop-complete`, { token: amina });
  await h.ok('POST', `/driver/rides/${ride.id}/complete`, { token: amina });
  return ride.id as string;
}

describe('PRD-35 · a passenger deletes her account in the app', () => {
  it('anonymises the profile, revokes sessions, keeps rides and payments under a pseudonym, and audits it', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const second = await h.login(PHONES.salma, 'passenger');
    const s = h.ctx.store.state;
    const user = userByPhone(h, PHONES.salma);
    const id = user.id;
    const rides = s.rides.filter((r) => r.passengerId === id).map((r) => r.id);
    const payments = s.payments.filter((p) => p.payerId === id).map((p) => p.id);
    const identityUploads = s.uploads.filter((u) => u.ownerId === id && u.purpose !== 'support_attachment');
    const familyTrips = (s.prototype?.trips ?? []).filter((t) => t.passengerId === id && t.status === 'scheduled').map((t) => t.id);
    const bookings = s.scheduled.filter((b) => b.passengerId === id && b.status === 'scheduled').map((b) => b.id);
    expect(rides.length).toBeGreaterThan(0);
    expect(bookings.length).toBeGreaterThan(0);
    expect(familyTrips.length).toBeGreaterThan(0);
    expect(identityUploads.length).toBeGreaterThan(0);
    const childNames = (s.prototype?.children ?? []).filter((x) => x.passengerId === id).map((x) => x.firstName);
    expect(childNames.length).toBeGreaterThan(0);
    // A past trip names the child in its timeline and notifications, and a resolved SOS alert carries her own step,
    // as the live flows write them (famille.ts applyFamilyEvent, prototype.ts /prototype/sos).
    h.ctx.store.tx((st) => {
      const p = st.prototype!;
      const trip = p.trips.find((t) => t.passengerId === id)!;
      const child = p.children.find((x) => x.id === trip.childId)!.firstName;
      trip.timeline.push({ at: trip.pickupAt, label: `Photo de ${child} prise à la prise en charge`, location: trip.pickup.location, kind: 'pickup_photo', actor: 'driver' });
      trip.notifications.push({ at: trip.pickupAt, kind: 'status', audience: 'parent', title: `${child} est arrivée`, body: `Déposée à ${trip.destination.label} · photo jointe.` });
      p.alerts.push({
        id: 'SOS-T1', userId: id, userName: 'Salma El Mansouri', role: 'passenger', rideId: rides[0]!, familyTripId: null, location: trip.pickup.location,
        createdAt: trip.pickupAt, status: 'resolved', contactName: 'Maman', resolvedAt: trip.pickupAt,
        actions: [{ at: trip.pickupAt, by: 'Salma', label: 'Alerte déclenchée · position enregistrée' }, { at: trip.pickupAt, by: 'Équipe sécurité', label: 'Alerte close' }],
      });
    });
    const auditFrom = s.audit.length;

    const r = await h.call('POST', '/me/deletion', { token: salma, body: {} });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true });

    // Every session of hers is revoked, not only the one that asked.
    expect((await h.call('GET', '/me', { token: salma })).status).toBe(401);
    expect((await h.call('GET', '/me', { token: second })).status).toBe(401);

    const after = h.ctx.store.state;
    const u = after.users.find((x) => x.id === id)!;
    expect(u).toMatchObject({ firstName: 'Compte', lastName: 'supprimé', phone: '', status: 'suspended', savedPlaces: [], testerCities: [] });
    expect(Object.values(u.notifications).every((v) => v === false)).toBe(true);
    expect(after.paymentMethods.filter((m) => m.userId === id)).toEqual([]);
    expect(after.sessions.filter((x) => x.subjectId === id)).toEqual([]);

    // Identity: details and photos erased, files included.
    const c = after.cases.find((x) => x.userId === id)!;
    expect(c.identity).toBeNull();
    expect(c.items.flatMap((i) => i.uploadIds)).toEqual([]);
    for (const up of identityUploads) {
      expect(after.uploads.some((x) => x.id === up.id)).toBe(false);
      expect(existsSync(join(h.ctx.config.dataDir, 'uploads', `${up.id}.jpg`))).toBe(false);
    }

    // Kept records: same ids, pseudonymised.
    expect(after.rides.filter((x) => x.passengerId === id).map((x) => x.id)).toEqual(rides);
    expect(after.rides.filter((x) => x.passengerId === id).every((x) => x.passenger.firstName === 'Compte supprimé')).toBe(true);
    expect(after.payments.filter((p) => p.payerId === id).map((p) => p.id)).toEqual(payments);
    // Scheduled rides have no chauffeuse yet: cancelled, free of charge.
    for (const bookingId of bookings) expect(after.scheduled.find((b) => b.id === bookingId)!.status).toBe('cancelled');

    // Naya Famille: children's details erased, upcoming trips cancelled, invited relatives revoked.
    const p = after.prototype!;
    for (const child of p.children.filter((x) => x.passengerId === id)) expect(child).toMatchObject({ firstName: 'Enfant', school: '', notes: '', recipients: [] });
    for (const tripId of familyTrips) expect(p.trips.find((t) => t.id === tripId)!.status).toBe('cancelled');
    // Kept trips (timelines, notifications) no longer name the child; her SOS alerts no longer name her.
    const keptTrips = JSON.stringify(p.trips.filter((t) => t.passengerId === id));
    for (const name of childNames) expect(keptTrips).not.toContain(name);
    const alert = p.alerts.find((a) => a.id === 'SOS-T1')!;
    expect(JSON.stringify(alert)).not.toContain('Salma');
    expect(alert.actions.map((x) => x.by)).toEqual(['Compte supprimé', 'Équipe sécurité']);
    expect(p.subscriptions.filter((x) => x.passengerId === id).every((x) => x.status === 'paused')).toBe(true);
    expect((p.guardians ?? []).filter((g) => g.passengerId === id).every((g) => g.status === 'revoked' && g.phone === null)).toBe(true);

    // One audit event, no personal data in anything this request appended, chain intact.
    const appended = after.audit.slice(auditFrom);
    const event = appended.find((e) => e.action === 'account.deleted')!;
    expect(event).toMatchObject({ entityType: 'user', entityId: id, actor: { type: 'user', id, name: 'Compte supprimé' } });
    const text = JSON.stringify(appended);
    for (const pii of [PHONES.salma, 'Salma', 'El Mansouri', 'Lina']) expect(text).not.toContain(pii);
    expect(verifyAuditChain(after.audit).valid).toBe(true);

    // The admin still opens the kept rides; the deleted account reads « Compte supprimé ».
    const admin = await h.adminLogin();
    const detail = await h.ok('GET', `/admin/rides/${rides[0]}`, { token: admin });
    expect(detail.passenger.firstName).toBe('Compte');

    // The same number signs up again as a new account, with a new verification.
    const fresh = await h.ok('POST', '/auth/otp/request', { body: { phone: PHONES.salma, role: 'passenger' } }).then(() =>
      h.ok('POST', '/auth/otp/verify', { body: { phone: PHONES.salma, role: 'passenger', code: '482913' } }),
    );
    expect(fresh.isNew).toBe(true);
    expect(fresh.user.id).not.toBe(id);
  });

  it('refuses while a ride is under way, and changes nothing', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const quote = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
    const cash = (await h.ok('GET', '/payment-methods', { token: salma })).find((m: any) => m.kind === 'cash');
    await h.ok('POST', '/rides', { token: salma, body: { quoteId: quote.id, paymentMethodId: cash.id } });
    const version = h.ctx.store.state.version;

    const r = await h.call('POST', '/me/deletion', { token: salma, body: {} });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('ACTIVE_RIDE_EXISTS');
    expect(r.body.error.message).toBe('Une course est en cours. Vous pourrez supprimer votre compte une fois la course terminée ou annulée.');
    expect(r.body.error.details.blockers).toContain('ride_active');
    expect(h.ctx.store.state.version).toBe(version);
    expect((await h.ok('GET', '/me', { token: salma })).user.firstName).toBe('Salma');
  });

  it('refuses while a payment is pending, then accepts once it is confirmed', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const rideId = await completedRide(h, salma, '3155');
    h.advance(600);
    const payment = (await h.ok('GET', `/rides/${rideId}`, { token: salma })).payments[0];
    expect(payment.status).toBe('pending');

    const refused = await h.call('POST', '/me/deletion', { token: salma, body: {} });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('PENDING_OPERATION');
    expect(refused.body.error.message).toBe('Un paiement est en cours de confirmation. Réessayez une fois qu’il sera confirmé.');
    expect(refused.body.error.details.blockers).toEqual(['payment_pending']);

    await h.ok('POST', `/provider-sandbox/payment/${payment.providerRef}/approve`, { token: salma });
    expect((await h.call('POST', '/me/deletion', { token: salma, body: {} })).status).toBe(200);
    expect(h.ctx.store.state.payments.find((p) => p.id === payment.id)!.status).toBe('confirmed');
  });

  it('refuses while money is left on her Naya wallet', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const id = userByPhone(h, PHONES.salma).id;
    h.ctx.store.tx((s) => {
      const w = s.prototype!.wallets.find((x) => x.userId === id);
      if (w) w.balance = 5_000;
      else s.prototype!.wallets.push({ userId: id, balance: 5_000, reserved: 0, entries: [] });
    });
    const r = await h.call('POST', '/me/deletion', { token: salma, body: {} });
    expect(r.status).toBe(409);
    expect(r.body.error.details.blockers).toEqual(['wallet_balance']);
    expect(r.body.error.message).toMatch(/^Il reste 50\sMAD sur votre portefeuille Naya\./);
  });

  it('is for passengers only and needs an Idempotency-Key', async () => {
    const h = setup();
    const amina = await h.login(PHONES.amina, 'driver');
    expect((await h.call('POST', '/me/deletion', { token: amina, body: {} })).status).toBe(403);
    const salma = await h.login(PHONES.salma, 'passenger');
    expect((await h.call('POST', '/me/deletion', { token: salma, body: {}, key: false })).status).toBe(422);
    expect((await h.call('POST', '/me/deletion', { body: {} })).status).toBe(401);
  });
});
