import { describe, expect, it } from 'vitest';
import { PHONES, setup, JPEG_B64 } from './harness';

describe('profile photo', () => {
  it('is set from an avatar upload, replaced, removed, and never from someone else’s file', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    expect((await h.ok('GET', '/me', { token: p })).user.avatarUploadId ?? null).toBeNull();

    const photo = await h.ok('POST', '/uploads', { token: p, body: { purpose: 'avatar', mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: 512, height: 512 } });
    expect((await h.ok('PATCH', '/me', { token: p, body: { avatarUploadId: photo.id } })).avatarUploadId).toBe(photo.id);
    expect((await h.call('GET', `/uploads/${photo.id}/preview`, { token: p })).status).toBe(200);

    const next = await h.ok('POST', '/uploads', { token: p, body: { purpose: 'avatar', mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: 512, height: 512 } });
    await h.ok('PATCH', '/me', { token: p, body: { avatarUploadId: next.id } });
    expect((await h.ok('GET', '/me', { token: p })).user.avatarUploadId).toBe(next.id);

    // A support attachment is not a profile photo.
    const doc = await h.ok('POST', '/uploads', { token: p, body: { purpose: 'support_attachment', mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: null, height: null } });
    expect((await h.call('PATCH', '/me', { token: p, body: { avatarUploadId: doc.id } })).status).toBe(422);
    // Another user's avatar cannot be borrowed.
    const d = await h.login(PHONES.amina, 'driver');
    const theirs = await h.ok('POST', '/uploads', { token: d, body: { purpose: 'avatar', mimeType: 'image/jpeg', dataBase64: JPEG_B64, width: 512, height: 512 } });
    expect((await h.call('PATCH', '/me', { token: p, body: { avatarUploadId: theirs.id } })).status).toBe(422);

    expect((await h.ok('PATCH', '/me', { token: p, body: { avatarUploadId: null } })).avatarUploadId).toBeNull();
  });
});

describe('phone number change', () => {
  it('needs a code sent to the new number, keeps the account, and refuses a number already in use', async () => {
    const h = setup();
    const p = await h.login(PHONES.salma, 'passenger');
    const before = (await h.ok('GET', '/me', { token: p })).user;
    const NEW = '+212699887766';

    // Same number, or a number another passenger already uses, is refused before any SMS.
    expect((await h.call('POST', '/me/phone/request', { token: p, body: { phone: PHONES.salma } })).status).toBe(422);
    expect((await h.call('POST', '/me/phone/request', { token: p, body: { phone: PHONES.nour } })).status).toBe(409);

    const sent = await h.ok('POST', '/me/phone/request', { token: p, body: { phone: NEW } });
    expect(sent.demoCode).toBe('123456');
    // The sign-in code path cannot confirm a change, and a wrong code is rejected.
    expect((await h.call('POST', '/me/phone/verify', { token: p, body: { phone: NEW, code: '000000' } })).status).toBe(422);
    const after = await h.ok('POST', '/me/phone/verify', { token: p, body: { phone: NEW, code: '123456' } });
    expect(after.phone).toBe(NEW);
    expect(after.id).toBe(before.id);
    // The session stays valid, and the new number now signs in to the same account.
    expect((await h.ok('GET', '/me', { token: p })).user.phone).toBe(NEW);
    const again = await h.login(NEW, 'passenger');
    expect((await h.ok('GET', '/me', { token: again })).user.id).toBe(before.id);
    // The change is in the audit trail.
    const audit = await h.ok('GET', '/admin/audit?action=account.phone_changed', { token: await h.adminLogin() });
    expect(JSON.stringify(audit)).toContain(before.id);
  });
});
