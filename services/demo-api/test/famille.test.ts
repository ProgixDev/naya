import { describe, expect, it } from 'vitest';
import { FAMILY_APPROVAL_TIMEOUT_SECONDS, FAMILY_DEMO_TIME_FACTOR } from '@naya/domain';
import { JPEG_B64, PHONES, setup } from './harness';

async function familySetup() {
  const h = setup();
  const p = await h.login(PHONES.salma, 'passenger');
  const d = await h.login(PHONES.amina, 'driver');
  const f = await h.ok('POST', '/prototype/family/example', { token: p });
  const trip = f.trips[0];
  const step = (body: Record<string, unknown>, token = d) => h.call('POST', `/prototype/family/trips/${trip.id}/advance`, { token, body });
  const get = async () => (await h.ok('GET', `/prototype/family/trips/${trip.id}`, { token: p })) as any;
  /** Plays the chauffeuse up to « Démarrer » and returns the pending approval. */
  const toApproval = async () => {
    expect((await step({ expectedStatus: 'scheduled' })).status).toBe(200);
    expect((await step({ expectedStatus: 'en_route' })).status).toBe(200);
    expect((await step({ expectedStatus: 'arrived', proof: 'demo-pickup-photo', childName: 'Lina' })).status).toBe(200);
    expect((await step({ expectedStatus: 'picked_up' })).status).toBe(200);
    return (await get()).approval;
  };
  return { h, p, d, trip, step, get, toApproval };
}

describe('Naya Famille safety flow', () => {
  it('needs the pick-up photo, the parent’s approval, then the school photo and code to close', async () => {
    const { h, p, d, trip, step, get } = await familySetup();
    await step({ expectedStatus: 'scheduled' });
    await step({ expectedStatus: 'en_route' });
    const noPhoto = await step({ expectedStatus: 'arrived', childName: 'Lina' });
    expect(noPhoto.status).toBe(422);
    expect(noPhoto.body.error.code).toBe('FAMILY_PROOF_REQUIRED');
    expect((await step({ expectedStatus: 'arrived', proof: 'demo-pickup-photo', childName: 'Nour' })).status).toBe(422);
    expect((await step({ expectedStatus: 'arrived', proof: 'demo-pickup-photo', childName: 'Lina' })).status).toBe(200);
    expect((await get()).pickupPhoto).toMatchObject({ simulated: true });

    // « Démarrer » only asks: the trip waits for the parent.
    await step({ expectedStatus: 'picked_up' });
    let t = await get();
    expect(t.status).toBe('awaiting_approval');
    expect(t.notifications.at(-1)).toMatchObject({ kind: 'approval_request', audience: 'parent', approvalId: t.approval.id });
    const pushed = await step({ expectedStatus: 'awaiting_approval' });
    expect(pushed.status).toBe(409);
    expect(pushed.body.error.code).toBe('FAMILY_APPROVAL_REQUIRED');
    expect((await h.call('POST', `/prototype/family/trips/${trip.id}/approval`, { token: d, body: { decision: 'approve', mode: 'on_site', approvalId: t.approval.id } })).status).toBe(403);
    expect((await h.call('POST', `/prototype/family/trips/${trip.id}/approval`, { token: p, body: { decision: 'approve', mode: 'on_site', approvalId: 'FA-999' } })).status).toBe(409);
    await h.ok('POST', `/prototype/family/trips/${trip.id}/approval`, { token: p, body: { decision: 'approve', mode: 'on_site', approvalId: t.approval.id } });
    t = await get();
    expect(t.status).toBe('in_progress');
    expect(t.approval).toMatchObject({ status: 'approved', mode: 'on_site', decidedBy: 'Salma' });

    // Live GPS: a new position every second.
    const a = await h.ok('GET', `/prototype/family/trips/${trip.id}/live`, { token: p });
    h.advance(1);
    const b = await h.ok('GET', `/prototype/family/trips/${trip.id}/live`, { token: d });
    expect(b.location).not.toEqual(a.location);
    expect(b.leg).toBe('to_school');
    expect(b.etaSeconds).toBeLessThan(a.etaSeconds);

    // Drop-off: photo required, on the school premises, plus the handover code.
    expect((await step({ expectedStatus: 'in_progress', recipientId: 'mother', code: '1234' })).body.error.code).toBe('FAMILY_PROOF_REQUIRED');
    expect((await step({ expectedStatus: 'in_progress', proof: 'demo-dropoff-photo', recipientId: 'mother', code: '1234' })).body.error.message).toMatch(/pas encore à l’école/);
    h.advance(Math.ceil(1020 / FAMILY_DEMO_TIME_FACTOR) + 1);
    expect((await step({ expectedStatus: 'in_progress', proof: 'demo-dropoff-photo', recipientId: 'mother', code: '9999' })).status).toBe(422);
    expect((await step({ expectedStatus: 'in_progress', proof: 'demo-dropoff-photo', recipientId: 'mother', code: '1234' })).status).toBe(200);
    t = await get();
    expect(t.status).toBe('completed');
    expect(t.dropoffPhoto).toMatchObject({ simulated: true });
    const kinds = t.timeline.map((e: any) => e.kind);
    expect(kinds).toEqual(['planned', 'departed', 'arrived', 'pickup_photo', 'start_requested', 'start_approved', 'live_started', 'dropoff_photo', 'completed']);
    expect(t.timeline.every((e: any) => typeof e.at === 'string')).toBe(true);
    // History keeps the trip; the weekly series continues.
    const all = await h.ok('GET', '/prototype/family', { token: p });
    expect(all.trips.map((x: any) => x.status)).toEqual(['completed', 'scheduled']);
  });

  it('a refused or unanswered start keeps the child at the pick-up point', async () => {
    const { h, p, d, trip, step, get, toApproval } = await familySetup();
    const first = await toApproval();
    await h.ok('POST', `/prototype/family/trips/${trip.id}/approval`, { token: p, body: { decision: 'refuse', mode: 'remote', approvalId: first.id, reason: 'Je viens la chercher' } });
    let t = await get();
    expect(t.status).toBe('picked_up');
    expect(t.approval).toMatchObject({ status: 'refused', reason: 'Je viens la chercher' });
    expect(t.notifications.at(-1)).toMatchObject({ audience: 'driver', kind: 'approval_result' });
    // She may ask again; without an answer the server expires the request.
    await step({ expectedStatus: 'picked_up' });
    h.advance(FAMILY_APPROVAL_TIMEOUT_SECONDS - 1);
    expect((await get()).status).toBe('awaiting_approval');
    h.advance(1);
    t = await get();
    expect(t.status).toBe('picked_up');
    expect(t.approval.status).toBe('expired');
    const late = await h.call('POST', `/prototype/family/trips/${trip.id}/approval`, { token: p, body: { decision: 'approve', mode: 'remote', approvalId: t.approval.id } });
    expect(late.status).toBe(409);
    // Third request, then the cap: call or cancel.
    await step({ expectedStatus: 'picked_up' });
    await h.ok('POST', `/prototype/family/trips/${trip.id}/approval`, { token: p, body: { decision: 'refuse', mode: 'remote', approvalId: (await get()).approval.id } });
    expect((await step({ expectedStatus: 'picked_up' })).body.error.code).toBe('FAMILY_APPROVAL_REQUIRED');
    const cancelled = await h.ok('POST', `/prototype/family/trips/${trip.id}/cancel`, { token: d, body: { reason: 'Enfant remis à sa mère sur place' } });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.timeline.map((e: any) => e.kind)).toEqual(expect.arrayContaining(['start_refused', 'start_expired', 'cancelled']));
  });

  it('only chauffeuses approved for Famille are assigned or can take a child', async () => {
    const { h, d, step } = await familySetup();
    const s = h.ctx.store.state;
    const admin = await h.adminLogin();
    const sub = s.prototype!.subscriptions[0]!;
    const leila = s.users.find((u) => u.phone === PHONES.leila)!;
    const nadia = s.users.find((u) => u.phone === PHONES.nadia)!;
    expect(leila.familleEligibility).toBe('not_requested');
    expect((await h.call('POST', `/admin/prototype/assignment/${sub.id}`, { token: admin, body: { driverId: leila.id } })).status).toBe(404);
    expect((await h.call('POST', `/admin/prototype/assignment/${sub.id}`, { token: admin, body: { driverId: nadia.id } })).status).toBe(200);
    await h.ok('POST', `/admin/prototype/assignment/${sub.id}`, { token: admin, body: { driverId: h.ctx.store.state.users.find((u) => u.phone === PHONES.amina)!.id } });
    // Approval withdrawn: she can no longer set off with a child. (A failed request restores
    // the store from a snapshot, so read the live state again.)
    h.ctx.store.state.users.find((u) => u.phone === PHONES.amina)!.familleEligibility = 'rejected';
    const refused = await step({ expectedStatus: 'scheduled' });
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('FAMILLE_NOT_ELIGIBLE');
    expect((await h.ok('GET', '/prototype/family', { token: d })).eligibility).toBe('rejected');
  });

  it('new subscriptions only pick a Famille-approved chauffeuse', async () => {
    const h = setup();
    for (const u of h.ctx.store.state.users) if (u.role === 'driver' && u.phone !== PHONES.nadia) u.familleEligibility = 'pending';
    const p = await h.login(PHONES.salma, 'passenger');
    const sub = await h.ok('POST', '/prototype/family/subscribe', { token: p, body: { planId: 'family-essential' } });
    expect(sub.driverName).toBe('Nadia Chraibi');
  });

  it('never sends handover codes to the chauffeuse', async () => {
    const { h, d, toApproval } = await familySetup();
    await toApproval();
    const view = await h.ok('GET', '/prototype/family', { token: d });
    // The field is absent, not blanked (P1): recipients carry names and relationships only.
    expect(view.children[0].recipients.map((r: any) => Object.keys(r).sort())).toEqual([['id', 'name', 'relationship'], ['id', 'name', 'relationship']]);
    expect(JSON.stringify(view)).not.toContain('verificationCode');
  });

  it('records WhatsApp (parent confirms), call requests and police calls on the trip', async () => {
    const { h, p, d, trip, get } = await familySetup();
    expect((await h.call('POST', `/prototype/family/trips/${trip.id}/calls`, { token: p, body: { channel: 'whatsapp' } })).status).toBe(422);
    const wa = await h.ok('POST', `/prototype/family/trips/${trip.id}/calls`, { token: p, body: { channel: 'whatsapp', confirmed: true } });
    expect(wa).toMatchObject({ url: 'https://wa.me/212661234567', appUrl: 'whatsapp://send?phone=212661234567', simulated: true });
    expect((await h.call('POST', `/prototype/family/trips/${trip.id}/calls`, { token: d, body: { channel: 'whatsapp', confirmed: true } })).status).toBe(403);
    await h.ok('POST', `/prototype/family/trips/${trip.id}/call-request`, { token: d });
    const police = await h.ok('POST', `/prototype/family/trips/${trip.id}/calls`, { token: d, body: { channel: 'police', confirmed: true } });
    expect(police).toMatchObject({ url: 'tel:19', simulated: false });
    const t = await get();
    expect(t.timeline.map((e: any) => e.kind)).toEqual(expect.arrayContaining(['call', 'call_request', 'police']));
    expect(t.notifications.filter((n: any) => n.audience === 'parent').map((n: any) => n.kind)).toEqual(expect.arrayContaining(['call_request', 'police']));
  });

  it('lets the parent invite the other parent through a revocable read-only link', async () => {
    const { h, p, toApproval } = await familySetup();
    await toApproval();
    const { guardian, token } = await h.ok('POST', '/prototype/family/guardians', { token: p, body: { name: 'Youssef', relationship: 'Père', phone: '+212600000001' } });
    expect(guardian.tokenHash).toBeUndefined();
    const view = await h.ok('GET', `/prototype/family/follow/${token}`);
    expect(view.trips[0]).toMatchObject({ childName: 'Lina', status: 'awaiting_approval' });
    expect(view.trips[0].live.leg).toBe('at_pickup');
    const raw = JSON.stringify(view);
    expect(raw).not.toMatch(/pickupPhoto|verificationCode|\+2126/);
    expect((await h.ok('GET', '/prototype/family', { token: p })).guardians[0].status).toBe('active');
    await h.ok('POST', `/prototype/family/guardians/${guardian.id}/revoke`, { token: p });
    expect((await h.call('GET', `/prototype/family/follow/${token}`)).status).toBe(404);
  });

  it('stores real photos as family proofs the parent can open', async () => {
    const { h, p, d, step, get } = await familySetup();
    await step({ expectedStatus: 'scheduled' });
    await step({ expectedStatus: 'en_route' });
    const photo = await h.ok('POST', '/uploads', { token: d, body: { purpose: 'family_proof', mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: 10, height: 10 } });
    await step({ expectedStatus: 'arrived', proof: photo.id, childName: 'Lina' });
    expect((await get()).pickupPhoto).toMatchObject({ uploadId: photo.id, simulated: false });
    expect((await h.call('GET', `/uploads/${photo.id}`, { token: p })).status).toBe(200);
    const other = await h.login(PHONES.nour, 'passenger');
    expect((await h.call('GET', `/uploads/${photo.id}`, { token: other })).status).toBe(403);
  });
});

describe('Naya Famille demo engine', () => {
  it('plays a whole trip with a simulated chauffeuse; the parent approves', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const trip = await h.ok('POST', '/dev/family/play', { token: p, body: { driver: true, parent: null } });
    const get = async () => (await h.ok('GET', `/prototype/family/trips/${trip.id}`, { token: p })) as any;
    for (let i = 0; i < 30 && (await get()).status !== 'awaiting_approval'; i++) h.advance(2);
    let t = await get();
    expect(t.status).toBe('awaiting_approval');
    expect(t.pickupPhoto.simulated).toBe(true);
    await h.ok('POST', `/prototype/family/trips/${trip.id}/approval`, { token: p, body: { decision: 'approve', mode: 'remote', approvalId: t.approval.id } });
    for (let i = 0; i < 40 && (await get()).status !== 'completed'; i++) h.advance(2);
    t = await get();
    expect(t.status).toBe('completed');
    expect(t.timeline.filter((e: any) => /simulation/.test(e.label)).length).toBeGreaterThanOrEqual(5);
  });

  it('plays the parent for the driver app: approve, refuse or no answer', async () => {
    const h = setup();
    const d = await h.login(PHONES.amina, 'driver');
    for (const parent of ['approve', 'refuse'] as const) {
      const trip = await h.ok('POST', '/dev/family/play', { token: d, body: { driver: false, parent } });
      const step = (body: unknown) => h.ok('POST', `/prototype/family/trips/${trip.id}/advance`, { token: d, body });
      await step({ expectedStatus: 'scheduled' });
      await step({ expectedStatus: 'en_route' });
      await step({ expectedStatus: 'arrived', proof: 'demo-pickup-photo', childName: 'Lina' });
      await step({ expectedStatus: 'picked_up' });
      h.advance(6);
      const t = await h.ok('GET', `/prototype/family/trips/${trip.id}`, { token: d });
      expect(t.status).toBe(parent === 'approve' ? 'in_progress' : 'picked_up');
    }
  });

  it('seeds a ready Famille scenario', async () => {
    const h = setup('famille');
    const p = await h.login(PHONES.salma, 'passenger');
    const f = await h.ok('GET', '/prototype/family', { token: p });
    expect(f.subscription.driverName).toBe('Amina Bennani');
    expect(f.trips[0]).toMatchObject({ childName: 'Lina', status: 'scheduled' });
  });
});
