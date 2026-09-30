import { describe, expect, it } from 'vitest';
import { mad, PLACES } from '@naya/domain';
import { verifyAuditChain } from '../src/audit';
import { AGDAL_TRIP, JPEG_B64, PHONES, setup } from './harness';

type H = ReturnType<typeof setup>;

async function bookRide(h: H, token: string, opts: { card?: string; stops?: typeof AGDAL_TRIP; city?: string } = {}) {
  const quote = await h.ok('POST', '/quotes', { token, body: { cityId: opts.city ?? 'rabat', stops: opts.stops ?? AGDAL_TRIP } });
  const methods = await h.ok('GET', '/payment-methods', { token });
  const pm = opts.card ? methods.find((m: any) => m.last4 === opts.card) : methods.find((m: any) => m.kind === 'cash');
  const ride = await h.ok('POST', '/rides', { token, body: { quoteId: quote.id, paymentMethodId: pm.id } });
  return { quote, ride };
}

async function driveToCompletion(h: H, driver: string, rideId: string) {
  await h.ok('POST', `/driver/rides/${rideId}/arrive`, { token: driver });
  await h.ok('POST', `/driver/rides/${rideId}/start`, { token: driver });
  const ride = (await h.ok('GET', `/rides/${rideId}`, { token: driver })).ride;
  for (let i = 0; i < ride.route.stops.length - 2; i++) await h.ok('POST', `/driver/rides/${rideId}/stop-complete`, { token: driver });
  return h.ok('POST', `/driver/rides/${rideId}/complete`, { token: driver });
}

async function acceptCurrentOffer(h: H, driver: string) {
  const status = await h.ok('GET', '/driver/status', { token: driver });
  expect(status.offer?.status).toBe('pending');
  await h.ok('POST', `/driver/offers/${status.offer.id}/accept`, { token: driver });
  return status.offer;
}

const wallet = async (h: H, token: string) => (await h.ok('GET', '/driver/wallet', { token })).wallet;

describe('S01 · registration and manual approval', () => {
  it('new passenger submits identity; submission is not approval; admin approves', async () => {
    const h = setup();
    const t = await h.login('+212677000001', 'passenger');
    const me = await h.ok('GET', '/me', { token: t });
    const caseId = me.cases[0].id;
    expect(me.cases[0].status).toBe('draft');
    await h.ok('PUT', `/verification/${caseId}/identity`, { token: t, body: { firstName: 'Yasmine', lastName: 'Kabbaj', birthDate: '1998-05-01', documentType: 'cin', documentNumber: 'AA112233' } });
    // Incomplete submission is refused.
    expect((await h.call('POST', `/verification/${caseId}/submit`, { token: t })).status).toBe(422);
    for (const key of ['selfie', 'id_front', 'id_back']) {
      const up = await h.ok('POST', '/uploads', { token: t, body: { purpose: key, mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: 900, height: 1200 } });
      await h.ok('PUT', `/verification/${caseId}/items/${key}`, { token: t, body: { uploadIds: [up.id] } });
    }
    const submitted = await h.ok('POST', `/verification/${caseId}/submit`, { token: t });
    expect(submitted.status).toBe('submitted');
    // Booking is blocked until approval.
    const q = await h.ok('POST', '/quotes', { token: t, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
    const pm = (await h.ok('GET', '/payment-methods', { token: t }))[0];
    expect((await h.call('POST', '/rides', { token: t, body: { quoteId: q.id, paymentMethodId: pm.id } })).body.error.code).toBe('VERIFICATION_REQUIRED');

    const admin = await h.adminLogin();
    const queue = await h.ok('GET', '/admin/verifications?status=queue', { token: admin });
    expect(queue.items.some((r: any) => r.case.id === caseId)).toBe(true);
    const detail = await h.ok('GET', `/admin/verifications/${caseId}`, { token: admin });
    // Uploaded documents are private to owner and reviewers.
    const other = await h.login(PHONES.salma, 'passenger');
    expect((await h.call('GET', `/uploads/${detail.case.items[0].uploadIds[0]}`, { token: other })).status).toBe(403);
    expect((await h.call('GET', `/uploads/${detail.case.items[0].uploadIds[0]}`, { token: admin })).status).toBe(200);
    const decided = await h.ok('POST', `/admin/verifications/${caseId}/decision`, { token: admin, body: { outcome: 'approved', reasonCode: null, message: '', corrections: [], expectedVersion: detail.case.version } });
    expect(decided.status).toBe('approved');
    expect((await h.ok('GET', '/me', { token: t })).cases[0].status).toBe('approved');
    const audit = await h.ok('GET', `/admin/audit?q=${caseId}`, { token: admin });
    expect(audit.items.some((e: any) => e.action === 'verification.approved')).toBe(true);
  });

  it('rejects uploads whose bytes are not the declared image type', async () => {
    const h = setup();
    const t = await h.login(PHONES.nour, 'passenger');
    const r = await h.call('POST', '/uploads', { token: t, body: { purpose: 'selfie', mimeType: 'image/jpeg', dataBase64: Buffer.from('<svg onload=alert(1)>').toString('base64').padEnd(24, 'A'), width: 1, height: 1 } });
    expect(r.status).toBe(422);
  });
});

describe('S02 · correction request, refusal and resubmission', () => {
  it('more info → corrected piece → resubmitted → approved; stale decisions conflict', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    const imane = await h.login(PHONES.imane, 'passenger');
    const me = await h.ok('GET', '/me', { token: imane });
    const c = me.cases[0];
    expect(c.status).toBe('more_info_requested');
    expect(c.items.find((i: any) => i.key === 'id_back').note).toMatch(/verso/);
    const up = await h.ok('POST', '/uploads', { token: imane, body: { purpose: 'id_back', mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: 1200, height: 800 } });
    await h.ok('PUT', `/verification/${c.id}/items/id_back`, { token: imane, body: { uploadIds: [up.id] } });
    expect((await h.ok('POST', `/verification/${c.id}/submit`, { token: imane })).status).toBe('submitted');
    const detail = await h.ok('GET', `/admin/verifications/${c.id}`, { token: admin });
    const stale = await h.call('POST', `/admin/verifications/${c.id}/decision`, { token: admin, body: { outcome: 'approved', reasonCode: null, message: '', corrections: [], expectedVersion: detail.case.version - 1 } });
    expect(stale.body.error.code).toBe('CONFLICT');
    expect((await h.ok('POST', `/admin/verifications/${c.id}/decision`, { token: admin, body: { outcome: 'approved', reasonCode: null, message: '', corrections: [], expectedVersion: detail.case.version } })).status).toBe('approved');
  });

  it('refusal requires a reason; a recoverable refusal can be restarted', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    const nour = await h.login(PHONES.nour, 'passenger');
    const c = (await h.ok('GET', '/me', { token: nour })).cases[0];
    const noReason = await h.call('POST', `/admin/verifications/${c.id}/decision`, { token: admin, body: { outcome: 'rejected', reasonCode: 'document_expired', message: '', corrections: [], expectedVersion: c.version } });
    expect(noReason.status).toBe(422);
    await h.ok('POST', `/admin/verifications/${c.id}/decision`, { token: admin, body: { outcome: 'rejected', reasonCode: 'document_expired', message: 'La pièce fournie est expirée depuis 2025.', corrections: [], expectedVersion: c.version } });
    const reopened = await h.ok('POST', `/verification/${c.id}/reopen`, { token: nour });
    expect(reopened.status).toBe('draft');
    expect(reopened.items.every((i: any) => i.uploadIds.length === 0)).toBe(true);
  });

  it('support agents cannot decide identity cases', async () => {
    const h = setup();
    const agent = await h.adminLogin('youssra@naya.demo', 'Naya-Support-2026');
    const nour = await h.login(PHONES.nour, 'passenger');
    const c = (await h.ok('GET', '/me', { token: nour })).cases[0];
    const r = await h.call('POST', `/admin/verifications/${c.id}/decision`, { token: agent, body: { outcome: 'approved', reasonCode: null, message: '', corrections: [], expectedVersion: c.version } });
    expect(r.status).toBe(403);
  });
});

describe('S03 · immediate cash ride with an Agdal stop (NY-001)', () => {
  it('cash fare 100: driver keeps 100, wallet −15, net 85', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { quote, ride } = await bookRide(h, salma);
    expect(quote.breakdown.total).toBe(mad(100));
    expect(quote.route.distanceMeters).toBe(10_000);
    expect(ride.id).toBe('NY-001');
    expect(ride.status).toBe('searching');
    const offer = await acceptCurrentOffer(h, amina);
    expect(offer.estimatedNet).toBe(mad(85));
    expect((await h.ok('GET', '/rides/active', { token: salma })).status).toBe('driver_assigned');
    const done = await driveToCompletion(h, amina, ride.id);
    expect(done.status).toBe('completed');
    expect((await wallet(h, amina)).balance).toBe(-mad(15));
    await h.ok('POST', `/driver/rides/${ride.id}/cash-collected`, { token: amina, body: { amount: mad(100) } });
    const earnings = await h.ok('GET', '/driver/earnings', { token: amina });
    expect([earnings.gross, earnings.commission, earnings.net, earnings.cashCollected]).toEqual([mad(100), mad(15), mad(85), mad(100)]);
    const detail = await h.ok('GET', `/rides/${ride.id}`, { token: salma });
    expect(detail.payments[0].status).toBe('confirmed');
    expect(detail.ride.timeline.some((e: any) => /Agdal/.test(e.label))).toBe(true);
  });

  it('cannot complete before confirming the intermediate stop', async () => {
    const h = setup('first-ride');
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { ride } = await bookRide(h, salma);
    await acceptCurrentOffer(h, amina);
    await h.ok('POST', `/driver/rides/${ride.id}/arrive`, { token: amina });
    await h.ok('POST', `/driver/rides/${ride.id}/start`, { token: amina });
    expect((await h.call('POST', `/driver/rides/${ride.id}/complete`, { token: amina })).status).toBe(409);
  });
});

describe('S04 · electronic payment and commission debt compensation (NY-002)', () => {
  it('card 100 credits net 85 only after confirmation: −15 → 70; totals reconcile', async () => {
    const h = setup('after-cash');
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    expect((await wallet(h, amina)).balance).toBe(-mad(15));
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { ride } = await bookRide(h, salma, { card: '4242' });
    expect(ride.id).toBe('NY-002');
    await acceptCurrentOffer(h, amina);
    await driveToCompletion(h, amina, ride.id);
    // Pending card payment creates no spendable funds.
    expect((await wallet(h, amina)).balance).toBe(-mad(15));
    expect((await h.ok('GET', '/driver/earnings', { token: amina })).pendingElectronic).toBe(mad(85));
    h.advance(3);
    expect((await wallet(h, amina)).balance).toBe(mad(70));
    const e = await h.ok('GET', '/driver/earnings', { token: amina });
    expect([e.gross, e.commission, e.net]).toEqual([mad(200), mad(30), mad(170)]);
    expect(e.cashCollected + (await wallet(h, amina)).balance).toBe(e.net);
    // A duplicate provider callback changes nothing.
    const payment = (await h.ok('GET', `/rides/${ride.id}`, { token: salma })).payments[0];
    const raw = JSON.stringify({ eventId: 'evt_dup_1', kind: 'payment', ref: payment.providerRef, outcome: 'confirmed', reason: null });
    await h.ok('POST', '/providers/demo/callback', { body: JSON.parse(raw), headers: { 'X-Naya-Signature': h.sign(raw) }, key: false });
    await h.ok('POST', '/providers/demo/callback', { body: JSON.parse(raw), headers: { 'X-Naya-Signature': h.sign(raw) }, key: false });
    expect((await wallet(h, amina)).balance).toBe(mad(70));
  });

  it('provider callbacks must be signed', async () => {
    const h = setup();
    const raw = JSON.stringify({ eventId: 'x', kind: 'payment', ref: 'nope', outcome: 'confirmed', reason: null });
    expect((await h.call('POST', '/providers/demo/callback', { body: JSON.parse(raw), headers: { 'X-Naya-Signature': 'bad' }, key: false })).status).toBe(401);
  });
});

describe('S05 · scheduled booking, modification and cancellation', () => {
  it('records without assignment, modifies time keeping the price, cancels, and dispatches when due', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const quote = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
    const pm = (await h.ok('GET', '/payment-methods', { token: salma })).find((m: any) => m.kind === 'cash');
    const tooSoon = await h.call('POST', '/scheduled', { token: salma, body: { quoteId: quote.id, paymentMethodId: pm.id, pickupAt: '2026-10-01T08:10:00.000Z' } });
    expect(tooSoon.body.error.code).toBe('SCHEDULE_TOO_SOON');
    const b = await h.ok('POST', '/scheduled', { token: salma, body: { quoteId: quote.id, paymentMethodId: pm.id, pickupAt: '2026-10-01T12:00:00.000Z' } });
    expect(b.status).toBe('scheduled');
    expect(b.rideId).toBeNull();
    const modified = await h.ok('PATCH', `/scheduled/${b.id}`, { token: salma, body: { pickupAt: '2026-10-01T13:00:00.000Z' } });
    expect(modified.terms.breakdown.total).toBe(mad(100));
    const cancelled = await h.ok('POST', `/scheduled/${b.id}/cancel`, { token: salma, body: { reasonCode: 'changed_plans' } });
    expect(cancelled.status).toBe('cancelled');
    // The seeded booking for tomorrow dispatches 15 minutes before pickup.
    const seeded = (await h.ok('GET', '/scheduled', { token: salma })).find((x: any) => x.status === 'scheduled');
    h.advance((Date.parse(seeded.pickupAt) - h.clock.now()) / 1000 - 14 * 60);
    const after = await h.ok('GET', `/scheduled/${seeded.id}`, { token: salma });
    expect(after.status).toBe('dispatched');
    expect((await h.ok('GET', '/rides/active', { token: salma })).scheduledBookingId).toBe(seeded.id);
  });

  it('refuses modification inside the cutoff', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const quote = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
    const pm = (await h.ok('GET', '/payment-methods', { token: salma }))[0];
    const b = await h.ok('POST', '/scheduled', { token: salma, body: { quoteId: quote.id, paymentMethodId: pm.id, pickupAt: '2026-10-01T09:30:00.000Z' } });
    h.advance(45 * 60);
    expect((await h.call('PATCH', `/scheduled/${b.id}`, { token: salma, body: { pickupAt: '2026-10-01T11:00:00.000Z' } })).body.error.code).toBe('SCHEDULE_CUTOFF');
  });
});

describe('S06 · dynamic price disclosure and city rule configuration', () => {
  it('×1,2 is disclosed in the quote, frozen at booking, and later changes do not alter it', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    const salma = await h.login(PHONES.salma, 'passenger');
    const cities = await h.ok('GET', '/admin/cities', { token: admin });
    const rabat = cities.find((x: any) => x.city.id === 'rabat').city;
    await h.ok('PUT', '/admin/cities/rabat/rules', { token: admin, body: { rules: { ...rabat.rules, dynamic: { ...rabat.rules.dynamic, enabled: true } }, reason: 'Forte demande autour de la gare ce soir.', expectedVersion: rabat.rulesVersion } });
    const quote = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
    expect(quote.breakdown.total).toBe(mad(120));
    expect(quote.breakdown.dynamicSurcharge).toBe(mad(20));
    expect(quote.conditions.dynamic.reason).toMatch(/demande/);
    const pm = (await h.ok('GET', '/payment-methods', { token: salma })).find((m: any) => m.kind === 'cash');
    const ride = await h.ok('POST', '/rides', { token: salma, body: { quoteId: quote.id, paymentMethodId: pm.id } });
    // Admin raises the base fare afterwards: the booking keeps its frozen terms.
    const current = (await h.ok('GET', '/admin/cities', { token: admin })).find((x: any) => x.city.id === 'rabat').city;
    await h.ok('PUT', '/admin/cities/rabat/rules', { token: admin, body: { rules: { ...current.rules, baseFare: mad(20) }, reason: 'Test de hausse de prise en charge.', expectedVersion: current.rulesVersion } });
    const after = (await h.ok('GET', `/rides/${ride.id}`, { token: salma })).ride;
    expect(after.terms.breakdown.total).toBe(mad(120));
    expect(after.terms.ruleVersion).toBe(2);
    const audit = await h.ok('GET', '/admin/audit?action=city.rules_updated', { token: admin });
    expect(audit.items).toHaveLength(2);
    expect(audit.integrity.valid).toBe(true);
  });

  it('rule updates need the current version and a reason', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    const rabat = (await h.ok('GET', '/admin/cities', { token: admin })).find((x: any) => x.city.id === 'rabat').city;
    expect((await h.call('PUT', '/admin/cities/rabat/rules', { token: admin, body: { rules: { ...rabat.rules, baseFare: mad(11) }, reason: 'court', expectedVersion: 1 } })).status).toBe(422);
    expect((await h.call('PUT', '/admin/cities/rabat/rules', { token: admin, body: { rules: { ...rabat.rules, baseFare: mad(11) }, reason: 'Ajustement de test suffisamment long.', expectedVersion: 7 } })).body.error.code).toBe('CONFLICT');
  });
});

describe('S07 · GPS denied, manual pickup, out-of-zone and no availability', () => {
  it('manual pin inside the zone works; out of zone is refused; no driver ends in no_driver with retry', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const pin = await h.ok('GET', `/places/reverse?lat=34.0135&lng=-6.8330`, { token: salma });
    expect(pin.id).toBeNull();
    const out = await h.call('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: [pin, PLACES.sale] } });
    expect(out.body.error.code).toBe('OUT_OF_ZONE');
    expect(out.body.error.details.index).toBe(1);
    const { ride } = await bookRide(h, salma, { stops: [pin, PLACES.agdal] });
    expect(ride.status).toBe('searching');
    h.advance(121);
    const active = await h.ok('GET', '/rides/active', { token: salma });
    expect(active.status).toBe('no_driver');
    expect((await h.ok('POST', `/rides/${ride.id}/retry-search`, { token: salma })).status).toBe('searching');
  });
});

describe('S08 · passenger cancellation with disclosed fee', () => {
  it('free within grace; after arrival the fee must be acknowledged and matches the preview', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { ride } = await bookRide(h, salma);
    await acceptCurrentOffer(h, amina);
    expect((await h.ok('GET', `/rides/${ride.id}/cancellation-preview`, { token: salma })).fee).toBe(0);
    await h.ok('POST', `/driver/rides/${ride.id}/arrive`, { token: amina });
    const preview = await h.ok('GET', `/rides/${ride.id}/cancellation-preview`, { token: salma });
    expect(preview.fee).toBe(mad(15));
    expect((await h.call('POST', `/rides/${ride.id}/cancel`, { token: salma, body: { reasonCode: 'changed_plans' } })).status).toBe(422);
    expect((await h.call('POST', `/rides/${ride.id}/cancel`, { token: salma, body: { reasonCode: 'changed_plans', acknowledgedFee: 0 } })).body.error.code).toBe('CONFLICT');
    const cancelled = await h.ok('POST', `/rides/${ride.id}/cancel`, { token: salma, body: { reasonCode: 'changed_plans', acknowledgedFee: mad(15) } });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellation.fee).toBe(mad(15));
    expect((await h.ok('GET', `/rides/${ride.id}`, { token: salma })).payments.find((p: any) => p.purpose === 'cancellation_fee').amount).toBe(mad(15));
  });
});

describe('S09 · driver cancellation and passenger recovery', () => {
  it('driver cancels with a reason; the ride is searched again and offered to another driver', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    const nadia = await h.login(PHONES.nadia, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { ride } = await bookRide(h, salma);
    await acceptCurrentOffer(h, amina);
    const r = await h.ok('POST', `/driver/rides/${ride.id}/cancel`, { token: amina, body: { reasonCode: 'vehicle_issue' } });
    expect(r.status).toBe('searching');
    const passengerView = await h.ok('GET', '/rides/active', { token: salma });
    expect(passengerView.status).toBe('searching');
    expect(passengerView.driverCancellations[0].reasonText).toBe('Problème de véhicule');
    // Amina is never offered the same ride again; Nadia receives it.
    await h.ok('POST', '/driver/online', { token: nadia, body: { online: true } });
    expect((await h.ok('GET', '/driver/status', { token: amina })).offer?.rideId === ride.id && (await h.ok('GET', '/driver/status', { token: amina })).offer?.status === 'pending').toBe(false);
    const offer = await acceptCurrentOffer(h, nadia);
    expect(offer.rideId).toBe(ride.id);
    // The passenger could also cancel for free while searching.
    expect((await h.ok('GET', `/rides/${ride.id}/cancellation-preview`, { token: salma })).fee).toBe(0);
  });
});

describe('S10 · independent driver and vehicle approvals', () => {
  it('person approved + vehicle pending cannot go online; approving the vehicle unlocks', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    const khadija = await h.login(PHONES.khadija, 'driver');
    const status = await h.ok('GET', '/driver/status', { token: khadija });
    expect(status.eligibility.reasons.map((r: any) => r.code)).toEqual(['vehicle_not_approved']);
    expect((await h.call('POST', '/driver/online', { token: khadija, body: { online: true } })).body.error.code).toBe('NOT_ELIGIBLE');
    const vehicleCase = (await h.ok('GET', '/me', { token: khadija })).cases.find((c: any) => c.subject === 'vehicle');
    await h.ok('POST', `/admin/verifications/${vehicleCase.id}/decision`, { token: admin, body: { outcome: 'approved', reasonCode: null, message: '', corrections: [], expectedVersion: vehicleCase.version } });
    expect((await h.ok('POST', '/driver/online', { token: khadija, body: { online: true } })).online).toBe(true);
    // Samira: vehicle approved, person needs correction → still blocked.
    const samira = await h.login(PHONES.samira, 'driver');
    expect((await h.ok('GET', '/driver/status', { token: samira })).eligibility.reasons.map((r: any) => r.code)).toEqual(['identity_not_approved']);
  });

  it('new driver creates person and vehicle cases separately', async () => {
    const h = setup();
    const t = await h.login('+212677000009', 'driver');
    const vc = await h.ok('POST', '/verification/vehicle', { token: t });
    expect(vc.subject).toBe('vehicle');
    await h.ok('PUT', `/verification/${vc.id}/vehicle`, { token: t, body: { make: 'Naya', model: 'Signature', color: 'Perle', plate: 'DÉMO-777', year: 2024 } });
    const me = await h.ok('GET', '/me', { token: t });
    expect(me.cases.map((c: any) => c.subject).sort()).toEqual(['driver_identity', 'vehicle']);
    expect(me.vehicle.plate).toBe('DÉMO-777');
  });
});

describe('S11 · offer acceptance, refusal, expiry and withdrawal', () => {
  it('30 s authoritative deadline; late acceptance refused; refusal re-dispatches; no auto-accept', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    const nadia = await h.login(PHONES.nadia, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { ride } = await bookRide(h, salma);
    const s1 = await h.ok('GET', '/driver/status', { token: amina });
    expect(Date.parse(s1.offer.expiresAt) - Date.parse(s1.offer.createdAt)).toBe(30_000);
    h.clock.advance(29);
    expect((await h.ok('GET', '/driver/status', { token: amina })).offer.status).toBe('pending');
    h.clock.advance(1); // exactly at the deadline, before any timer ran
    const late = await h.call('POST', `/driver/offers/${s1.offer.id}/accept`, { token: amina });
    expect(late.body.error.code).toBe('OFFER_EXPIRED');
    expect((await h.ok('GET', '/driver/status', { token: amina })).offer.status).toBe('expired');
    expect((await h.ok('GET', '/rides/active', { token: salma })).status).toBe('searching');

    // Refusal: next driver gets it.
    await h.ok('POST', '/driver/online', { token: nadia, body: { online: true } });
    const n1 = await h.ok('GET', '/driver/status', { token: nadia });
    expect(n1.offer.rideId).toBe(ride.id);
    await h.ok('POST', `/driver/offers/${n1.offer.id}/decline`, { token: nadia, body: { reasonCode: 'too_far' } });
    expect((await h.ok('GET', '/driver/status', { token: nadia })).offer.status).toBe('declined');
    // Nobody left: nothing is assigned automatically.
    h.advance(120);
    expect((await h.ok('GET', '/rides/active', { token: salma })).status).toBe('no_driver');
  });

  it('withdrawn when the passenger cancels; accepting then fails', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { ride } = await bookRide(h, salma);
    const offer = (await h.ok('GET', '/driver/status', { token: amina })).offer;
    await h.ok('POST', `/rides/${ride.id}/cancel`, { token: salma, body: { reasonCode: 'changed_plans' } });
    expect((await h.ok('GET', '/driver/status', { token: amina })).offer.status).toBe('withdrawn');
    expect((await h.call('POST', `/driver/offers/${offer.id}/accept`, { token: amina })).body.error.code).toBe('OFFER_NOT_PENDING');
  });

  it('assignment race: a second acceptance of the same ride is refused', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    await bookRide(h, salma);
    const offer = (await h.ok('GET', '/driver/status', { token: amina })).offer;
    const [a, b] = await Promise.all([
      h.call('POST', `/driver/offers/${offer.id}/accept`, { token: amina, key: 'race-a' }),
      h.call('POST', `/driver/offers/${offer.id}/accept`, { token: amina, key: 'race-b' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });
});

describe('S12 · debt threshold and recharge recovery', () => {
  it('−150 blocks; pending/failed recharge keeps −150; confirmed 50 → −100 restores', async () => {
    const h = setup();
    const leila = await h.login(PHONES.leila, 'driver');
    expect((await wallet(h, leila)).balance).toBe(-mad(150));
    expect((await h.call('POST', '/driver/online', { token: leila, body: { online: true } })).body.error.code).toBe('DEBT_LIMIT_REACHED');
    const providers = await h.ok('GET', '/payment-providers?purpose=recharge', { token: leila });
    const card = providers.find((p: any) => p.kind === 'card');
    const r1 = await h.ok('POST', '/driver/recharges', { token: leila, body: { amount: mad(50), providerId: card.id } });
    expect(r1.status).toBe('pending');
    expect((await wallet(h, leila)).balance).toBe(-mad(150));
    expect((await wallet(h, leila)).offersBlockedByDebt).toBe(true);
    await h.ok('POST', `/provider-sandbox/recharge/${r1.providerRef}/decline`, { token: leila });
    expect((await h.ok('GET', `/driver/recharges/${r1.id}`, { token: leila })).status).toBe('failed');
    expect((await wallet(h, leila)).balance).toBe(-mad(150));
    const r2 = await h.ok('POST', '/driver/recharges', { token: leila, body: { amount: mad(50), providerId: card.id } });
    await h.ok('POST', `/provider-sandbox/recharge/${r2.providerRef}/approve`, { token: leila });
    const w = await wallet(h, leila);
    expect(w.balance).toBe(-mad(100));
    expect(w.offersBlockedByDebt).toBe(false);
    expect((await h.ok('POST', '/driver/online', { token: leila, body: { online: true } })).online).toBe(true);
  });

  it('−15 does not block; reaching the threshold during a ride does not interrupt it', async () => {
    const h = setup('after-cash');
    const amina = await h.login(PHONES.amina, 'driver');
    expect((await h.ok('POST', '/driver/online', { token: amina, body: { online: true } })).online).toBe(true);
    const salma = await h.login(PHONES.salma, 'passenger');
    const { ride } = await bookRide(h, salma);
    await acceptCurrentOffer(h, amina);
    await h.ok('POST', `/driver/rides/${ride.id}/arrive`, { token: amina });
    // An exceptional correction pushes the balance past the threshold mid-ride.
    const admin = await h.adminLogin();
    await h.ok('POST', '/admin/finance/corrections', { token: admin, body: { driverId: 'DR-001', amount: -mad(140), reason: 'Régularisation de test pendant une course.' } });
    expect((await wallet(h, amina)).offersBlockedByDebt).toBe(true);
    await h.ok('POST', `/driver/rides/${ride.id}/start`, { token: amina });
    await h.ok('POST', `/driver/rides/${ride.id}/stop-complete`, { token: amina });
    expect((await h.ok('POST', `/driver/rides/${ride.id}/complete`, { token: amina })).status).toBe('completed');
  });
});

describe('S13 · withdrawal reservation, success and failure', () => {
  it('70 → pending 70/50/20 → confirmed 20/0/20', async () => {
    const h = setup();
    const amina = await h.login(PHONES.amina, 'driver');
    const accounts = (await h.ok('GET', '/driver/wallet', { token: amina })).payoutAccounts;
    const main = accounts.find((a: any) => a.last4 === '4821');
    const w = await h.ok('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(50), payoutAccountId: main.id } });
    let wl = await wallet(h, amina);
    expect([wl.balance, wl.reserved, wl.available]).toEqual([mad(70), mad(50), mad(20)]);
    // A second withdrawal while one is pending is refused.
    expect((await h.call('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(10), payoutAccountId: main.id } })).body.error.code).toBe('PENDING_OPERATION');
    h.advance(8);
    expect((await h.ok('GET', `/driver/withdrawals/${w.id}`, { token: amina })).status).toBe('confirmed');
    wl = await wallet(h, amina);
    expect([wl.balance, wl.reserved, wl.available]).toEqual([mad(20), 0, mad(20)]);
  });

  it('failure releases the reservation without an artificial credit: 70/0/70', async () => {
    const h = setup();
    const amina = await h.login(PHONES.amina, 'driver');
    const test = (await h.ok('GET', '/driver/wallet', { token: amina })).payoutAccounts.find((a: any) => a.last4 === '0000');
    await h.ok('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(50), payoutAccountId: test.id } });
    const before = (await h.ok('GET', '/driver/ledger', { token: amina })).total;
    h.advance(5);
    const wl = await wallet(h, amina);
    expect([wl.balance, wl.reserved, wl.available]).toEqual([mad(70), 0, mad(70)]);
    expect((await h.ok('GET', '/driver/ledger', { token: amina })).total).toBe(before);
  });

  it('recharge 50 then withdrawal: 120 → pending 120/50/70 → success 70 / failure 120', async () => {
    for (const outcome of ['success', 'failure'] as const) {
      const h = setup();
      const amina = await h.login(PHONES.amina, 'driver');
      const card = (await h.ok('GET', '/payment-providers?purpose=recharge', { token: amina })).find((p: any) => p.kind === 'card');
      const r = await h.ok('POST', '/driver/recharges', { token: amina, body: { amount: mad(50), providerId: card.id } });
      expect((await wallet(h, amina)).balance).toBe(mad(70));
      await h.ok('POST', `/provider-sandbox/recharge/${r.providerRef}/approve`, { token: amina });
      expect((await wallet(h, amina)).balance).toBe(mad(120));
      const accounts = (await h.ok('GET', '/driver/wallet', { token: amina })).payoutAccounts;
      const acc = accounts.find((a: any) => a.last4 === (outcome === 'success' ? '4821' : '0000'));
      await h.ok('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(50), payoutAccountId: acc.id } });
      const p = await wallet(h, amina);
      expect([p.balance, p.reserved, p.available]).toEqual([mad(120), mad(50), mad(70)]);
      h.advance(8);
      expect((await wallet(h, amina)).balance).toBe(outcome === 'success' ? mad(70) : mad(120));
    }
  });

  it('refuses more than the available amount and replays idempotent requests', async () => {
    const h = setup();
    const amina = await h.login(PHONES.amina, 'driver');
    const main = (await h.ok('GET', '/driver/wallet', { token: amina })).payoutAccounts[0];
    expect((await h.call('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(71), payoutAccountId: main.id } })).body.error.code).toBe('INSUFFICIENT_AVAILABLE');
    const a = await h.ok('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(50), payoutAccountId: main.id }, key: 'same' });
    const b = await h.ok('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(50), payoutAccountId: main.id }, key: 'same' });
    expect(b.id).toBe(a.id);
    expect((await h.call('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(40), payoutAccountId: main.id }, key: 'same' })).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect((await h.call('POST', '/driver/withdrawals', { token: amina, body: { amount: mad(10), payoutAccountId: main.id }, key: false })).status).toBe(422);
  });
});

describe('S14 · history, support ticket, reply and admin resolution', () => {
  it('passenger opens a dispute on NY-001; admin replies and resolves with audit', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const history = await h.ok('GET', '/rides', { token: salma });
    expect(history.items.map((r: any) => r.id)).toEqual(['NY-002', 'NY-001']);
    const t = await h.ok('POST', '/support/tickets', { token: salma, body: { rideId: 'NY-001', category: 'payment', subject: 'Montant de la course NY-001', body: 'Le montant ne correspond pas à ce que j’attendais.', attachments: [] } });
    expect(t.isDispute).toBe(true);
    const admin = await h.adminLogin();
    await h.ok('POST', `/admin/support/${t.id}/messages`, { token: admin, body: { body: 'Nous avons vérifié : le prix affiché était 100 MAD, arrêt Agdal inclus.' } });
    expect((await h.ok('GET', `/support/tickets/${t.id}`, { token: salma })).status).toBe('awaiting_user');
    await h.ok('POST', `/support/tickets/${t.id}/messages`, { token: salma, body: { body: 'Merci pour la vérification.' } });
    const resolved = await h.ok('POST', `/admin/support/${t.id}/resolve`, { token: admin, body: { outcome: 'Tarif confirmé', note: 'Prix conforme au devis accepté, aucun remboursement.' } });
    expect(resolved.status).toBe('resolved');
    expect((await h.ok('GET', '/admin/audit?action=support.resolved', { token: admin })).items[0].entityId).toBe(t.id);
    // A passenger cannot open a ticket on someone else's ride.
    const nour = await h.login(PHONES.nour, 'passenger');
    expect((await h.call('POST', '/support/tickets', { token: nour, body: { rideId: 'NY-001', category: 'ride', subject: 'Test accès', body: 'Je ne devrais pas pouvoir faire ceci.', attachments: [] } })).status).toBe(403);
  });
});

describe('S15 · future city configuration with distinct rules and audit', () => {
  it('adds Casablanca as test city: 107 MAD, ×1,2 → 128,40, 18 %, 200 debt limit; testers only', async () => {
    const h = setup('no-casablanca');
    const admin = await h.adminLogin();
    const rules = { baseFare: mad(12), perKm: mad(4.5), perMinute: mad(2), minimumFare: mad(35), commissionBp: 1800, debtLimit: mad(200), cancellation: { graceSeconds: 120, feeAfterGrace: mad(10), feeAfterArrival: mad(15) }, dynamic: { enabled: false, multiplierBp: 12000, reason: 'Forte demande à Casablanca.' }, offerTimeoutSeconds: 30, searchTimeoutSeconds: 120, quoteValiditySeconds: 600, scheduling: { minLeadMinutes: 30, maxDaysAhead: 7, modifyCutoffMinutes: 60 }, minimumWithdrawal: mad(20) };
    await h.ok('POST', '/admin/cities', { token: admin, body: { id: 'casablanca', name: 'Casablanca', status: 'test', center: { lat: 33.5883, lng: -7.6114 }, rules, reason: 'Préparation du lancement pilote à Casablanca.' } });
    await h.ok('POST', '/admin/cities/casablanca/zones', { token: admin, body: { name: 'Casablanca · centre', polygon: [{ lat: 33.62, lng: -7.68 }, { lat: 33.615, lng: -7.58 }, { lat: 33.55, lng: -7.57 }, { lat: 33.54, lng: -7.69 }], active: true, reason: 'Zone pilote du centre-ville.' } });
    const salma = await h.login(PHONES.salma, 'passenger');
    const trip = [PLACES.casaPort, PLACES.anfa];
    const q = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'casablanca', stops: trip } });
    expect(q.breakdown.total).toBe(mad(107));
    const nour = await h.login(PHONES.hiba, 'passenger');
    expect((await h.call('POST', '/quotes', { token: nour, body: { cityId: 'casablanca', stops: trip } })).body.error.code).toBe('CITY_INACTIVE');
    const city = (await h.ok('GET', '/admin/cities', { token: admin })).find((x: any) => x.city.id === 'casablanca').city;
    await h.ok('PUT', '/admin/cities/casablanca/rules', { token: admin, body: { rules: { ...city.rules, dynamic: { ...city.rules.dynamic, enabled: true } }, reason: 'Test de la majoration dynamique pilote.', expectedVersion: 1 } });
    expect((await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'casablanca', stops: trip } })).breakdown.total).toBe(12_840);
    // Rabat is unaffected.
    expect((await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } })).breakdown.total).toBe(mad(100));
    const audit = await h.ok('GET', '/admin/audit?cityId=casablanca', { token: admin });
    expect(audit.items.map((e: any) => e.action)).toEqual(expect.arrayContaining(['city.created', 'zone.created', 'city.rules_updated']));
    expect(audit.integrity.valid).toBe(true);
  });
});

describe('S16 · stale tracking and pending/failed payment, recharge, withdrawal', () => {
  it('frozen tracking becomes stale after 20 s; failed card payment can be retried; no credit before confirmation', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { ride } = await bookRide(h, salma, { card: '0002' });
    await acceptCurrentOffer(h, amina);
    expect((await h.ok('GET', '/rides/active', { token: salma })).driverLocation.stale).toBe(false);
    await h.ok('POST', `/dev/tracking/${ride.id}/freeze`);
    h.advance(21);
    expect((await h.ok('GET', '/rides/active', { token: salma })).driverLocation.stale).toBe(true);
    await h.ok('POST', `/dev/tracking/${ride.id}/resume`);
    await driveToCompletion(h, amina, ride.id);
    h.advance(3);
    const detail = await h.ok('GET', `/rides/${ride.id}`, { token: salma });
    expect(detail.payments[0].status).toBe('failed');
    expect((await wallet(h, amina)).balance).toBe(mad(70));
    const good = (await h.ok('GET', '/payment-methods', { token: salma })).find((m: any) => m.last4 === '4242');
    await h.ok('POST', `/rides/${ride.id}/payment/retry`, { token: salma, body: { paymentMethodId: good.id } });
    h.advance(3);
    expect((await wallet(h, amina)).balance).toBe(mad(70 + 85));
  });

  it('a pending card payment stays pending and credits nothing', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const { ride } = await bookRide(h, salma, { card: '3155' });
    await acceptCurrentOffer(h, amina);
    await driveToCompletion(h, amina, ride.id);
    h.advance(600);
    expect((await h.ok('GET', `/rides/${ride.id}`, { token: salma })).payments[0].status).toBe('pending');
    expect((await wallet(h, amina)).balance).toBe(mad(70));
  });
});

describe('platform guarantees', () => {
  it('authorizes every operation by role', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    const amina = await h.login(PHONES.amina, 'driver');
    expect((await h.call('GET', '/driver/wallet', { token: salma })).status).toBe(403);
    expect((await h.call('POST', '/quotes', { token: amina, body: { cityId: 'rabat', stops: AGDAL_TRIP } })).status).toBe(403);
    expect((await h.call('GET', '/admin/overview', { token: salma })).status).toBe(403);
    expect((await h.call('GET', '/me')).status).toBe(401);
    const agent = await h.adminLogin('youssra@naya.demo', 'Naya-Support-2026');
    expect((await h.call('GET', '/admin/finance/summary', { token: agent })).status).toBe(403);
    expect((await h.call('POST', '/admin/finance/corrections', { token: agent, body: { driverId: 'DR-001', amount: 100, reason: 'Tentative sans permission.' } })).status).toBe(403);
  });

  it('OTP: wrong code, rate limit and expiry', async () => {
    const h = setup();
    await h.ok('POST', '/auth/otp/request', { body: { phone: PHONES.salma, role: 'passenger' } });
    expect((await h.call('POST', '/auth/otp/request', { body: { phone: PHONES.salma, role: 'passenger' } })).body.error.code).toBe('OTP_RATE_LIMITED');
    expect((await h.call('POST', '/auth/otp/verify', { body: { phone: PHONES.salma, role: 'passenger', code: '000000' } })).body.error.code).toBe('OTP_INVALID');
    h.advance(301);
    expect((await h.call('POST', '/auth/otp/verify', { body: { phone: PHONES.salma, role: 'passenger', code: '123456' } })).body.error.code).toBe('OTP_EXPIRED');
  });

  it('corrections require permission, a reason, and are audited with before/after', async () => {
    const h = setup();
    const admin = await h.adminLogin();
    expect((await h.call('POST', '/admin/finance/corrections', { token: admin, body: { driverId: 'DR-001', amount: 500, reason: 'court' } })).status).toBe(422);
    const e = await h.ok('POST', '/admin/finance/corrections', { token: admin, body: { driverId: 'DR-001', amount: 500, reason: 'Remboursement d’un péage signalé par la chauffeuse.' } });
    expect(e.balanceAfter).toBe(mad(75));
    const audit = await h.ok('GET', '/admin/audit?action=finance.correction', { token: admin });
    expect(audit.items[0].before).toEqual({ balance: mad(70) });
    expect(audit.items[0].after).toEqual({ balance: mad(75) });
  });

  it('the audit chain detects tampering', async () => {
    const h = setup();
    const events = h.ctx.store.state.audit;
    expect(verifyAuditChain(events).valid).toBe(true);
    const tampered = events.map((e, i) => (i === 1 ? { ...e, summary: 'modifié' } : e));
    expect(verifyAuditChain(tampered).valid).toBe(false);
  });

  it('cannot book two rides at once, and quotes expire', async () => {
    const h = setup();
    const salma = await h.login(PHONES.salma, 'passenger');
    await bookRide(h, salma);
    const q = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
    const pm = (await h.ok('GET', '/payment-methods', { token: salma }))[0];
    expect((await h.call('POST', '/rides', { token: salma, body: { quoteId: q.id, paymentMethodId: pm.id } })).body.error.code).toBe('ACTIVE_RIDE_EXISTS');
    h.advance(601);
    expect((await h.call('POST', '/rides', { token: salma, body: { quoteId: q.id, paymentMethodId: pm.id } })).body.error.code).toMatch(/ACTIVE_RIDE_EXISTS|QUOTE_EXPIRED/);
  });
});
