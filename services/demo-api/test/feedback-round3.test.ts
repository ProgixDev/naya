import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { PLACES } from '@naya/domain';
import { PHONES, setup, JPEG_B64, START } from './harness';

/** Minimal MP4 header ("ftyp" box) followed by padding. */
const MP4_B64 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(40)]).toString('base64');

describe('feedback round 3', () => {
  it('accepts short videos as dispute evidence only', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const video = await h.ok('POST', '/uploads', { token: p, body: { purpose: 'support_attachment', mimeType: 'video/mp4', dataBase64: MP4_B64, width: null, height: null } });
    expect(video.mimeType).toBe('video/mp4');
    expect((await h.call('POST', '/uploads', { token: p, body: { purpose: 'avatar', mimeType: 'video/mp4', dataBase64: MP4_B64, width: null, height: null } })).status).toBe(422);
    // Declared type must match the content.
    expect((await h.call('POST', '/uploads', { token: p, body: { purpose: 'support_attachment', mimeType: 'video/mp4', dataBase64: JPEG_B64, width: null, height: null } })).status).toBe(422);
  });

  it('serves cancellation reasons from the back-office, per role', async () => {
    const h = setup();
    const a = await h.adminLogin();
    const p = await h.login(PHONES.salma, 'passenger');
    await h.ok('PUT', '/admin/prototype/catalog/cancelReasons', { token: a, body: { id: 'child_sick', label: 'Mon enfant est malade', role: 'passenger', enabled: true } });
    await h.ok('PUT', '/admin/prototype/catalog/cancelReasons', { token: a, body: { id: 'other', label: 'Autre (chauffeuse)', role: 'driver', enabled: true } });
    const catalog = await h.ok('GET', '/prototype/catalog', { token: p });
    const passenger = catalog.cancelReasons.filter((r: any) => r.role === 'passenger');
    expect(passenger.map((r: any) => r.id)).toContain('child_sick');
    // Same id on the other role is a separate row: the passenger "other" is untouched.
    expect(passenger.find((r: any) => r.id === 'other').label).toBe('Autre raison');
    expect(catalog.cancelReasons.find((r: any) => r.id === 'other' && r.role === 'driver').label).toBe('Autre (chauffeuse)');
    // The seeded booking for tomorrow is cancelled with the new reason, which keeps its label.
    const seeded = (await h.ok('GET', '/scheduled', { token: p })).find((x: any) => x.status === 'scheduled');
    const cancelled = await h.ok('POST', `/scheduled/${seeded.id}/cancel`, { token: p, body: { reasonCode: 'child_sick' } });
    expect(cancelled.cancellation.reasonText).toBe('Mon enfant est malade');
  });

  it('gives pool plans a driver per trip instead of a fixed one', async () => {
    const h = setup();
    const a = await h.adminLogin();
    const p = await h.login(PHONES.salma, 'passenger');
    const plan = (await h.ok('GET', '/prototype/catalog', { token: p })).plans[0];
    await h.ok('PUT', '/admin/prototype/catalog/plans', { token: a, body: { ...plan, dedicatedDriver: false } });
    const sub = await h.ok('POST', '/prototype/family/subscribe', { token: p, key: 'pool-sub', body: { planId: plan.id } });
    expect(sub.dedicated).toBe(false);
    expect(sub.driverName).toMatch(/Pool/);
    const f = await h.ok('GET', '/prototype/family', { token: p });
    if (f.children.length) {
      const trip = await h.ok('POST', '/prototype/family/trips', { token: p, key: 'pool-trip', body: { childId: f.children[0].id, pickup: PLACES.hayRiad, destination: PLACES.agdal, pickupAt: new Date(Date.parse(START) + 86400000).toISOString(), weekdays: [], kind: 'home_school' } });
      expect(trip.driverName).not.toMatch(/Pool/);
    }
  });

  it('lets safety agents handle SOS without settings rights, and filters finance and disputes on the server', async () => {
    const h = setup();
    const support = await h.adminLogin('youssra@naya.demo', 'Naya-Support-2026');
    expect((await h.call('GET', '/admin/safety/alerts', { token: support })).status).toBe(200);
    expect((await h.call('GET', '/admin/prototype', { token: support })).status).toBe(403);
    const a = await h.adminLogin();
    const all = await h.ok('GET', '/admin/finance/summary?cityId=all', { token: a });
    const rabat = await h.ok('GET', '/admin/finance/summary?cityId=rabat', { token: a });
    expect(all.drivers.length).toBeGreaterThanOrEqual(rabat.drivers.length);
    expect(Array.isArray(all.failedTopups)).toBe(true);
    const everything = await h.ok('GET', '/admin/support?status=', { token: a });
    const searched = await h.ok('GET', `/admin/support?status=&q=${encodeURIComponent('zzz-no-match')}`, { token: a });
    expect(searched.total).toBe(0);
    expect(everything.total).toBeGreaterThan(0);
    const byRole = await h.ok('GET', '/admin/support?status=&role=driver', { token: a });
    expect(byRole.items.every((t: any) => t.userRole === 'driver')).toBe(true);
  });
});
