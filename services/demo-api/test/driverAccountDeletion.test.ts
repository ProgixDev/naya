import { describe, expect, it } from 'vitest';
import { DomainError } from '@naya/domain';
import { verifyAuditChain } from '../src/audit';
import { deleteAccount, deletionBlockers } from '../src/services/auth';
import { postLedger, walletOf } from '../src/services/finance';
import { AGDAL_TRIP, PHONES, setup } from './harness';

type H = ReturnType<typeof setup>;

/** Seeded chauffeuse with both dossiers approved and an empty wallet. */
const HOUDA = '+212667890123';

const driverByPhone = (h: H, phone: string) => h.ctx.store.state.users.find((u) => u.phone === phone && u.role === 'driver')!;

/** Runs the deletion as the route does and returns the refusal, or null when it went through. */
function tryDelete(h: H, phone: string): DomainError | null {
  try {
    deleteAccount(h.ctx, driverByPhone(h, phone));
    return null;
  } catch (e) {
    if (e instanceof DomainError) return e;
    throw e;
  }
}

/** Brings a chauffeuse's wallet to exactly zero with one correction, as the assistance would. */
function settle(h: H, phone: string) {
  const id = driverByPhone(h, phone).id;
  h.ctx.store.tx((s) => {
    const balance = walletOf(s, id, h.ctx.clock.iso()).balance;
    if (balance !== 0) postLedger(s, h.ctx.clock.iso(), { driverId: id, type: 'correction', amount: -balance, idempotencyKey: `test:settle:${id}`, description: 'Solde réglé avec l’assistance' } as never);
  });
}

describe('PRD-35 · a chauffeuse deletes her account in the app (ADR-0055, driver rules)', () => {
  it('refuses while she owes commission and says how to settle it; once settled, anonymises and keeps the rides she drove', async () => {
    const h = setup();
    const leila = await h.login(PHONES.leila, 'driver');
    const user = driverByPhone(h, PHONES.leila);
    const id = user.id;
    const version = h.ctx.store.state.version;

    const refused = tryDelete(h, PHONES.leila)!;
    expect(refused.code).toBe('PENDING_OPERATION');
    expect(refused.details?.blockers).toEqual(['wallet_debt']);
    expect(refused.message).toMatch(/^Votre portefeuille Naya doit encore 150\sMAD de commission\. Rechargez-le ou contactez l’assistance/);
    expect(h.ctx.store.state.version).toBe(version);

    settle(h, PHONES.leila);
    const s = h.ctx.store.state;
    const driven = s.rides.filter((r) => r.driverId === id).map((r) => r.id);
    const ledger = s.ledger.filter((e) => e.driverId === id).map((e) => e.id);
    const plates = s.rides.filter((r) => r.driverId === id).map((r) => r.driver?.vehicle.plate);
    expect(driven.length).toBeGreaterThan(0);
    expect(s.payoutAccounts.some((a) => a.driverId === id)).toBe(true);
    const auditFrom = s.audit.length;

    expect(tryDelete(h, PHONES.leila)).toBeNull();

    // Signed out everywhere.
    expect((await h.call('GET', '/me', { token: leila })).status).toBe(401);

    const after = h.ctx.store.state;
    expect(after.users.find((u) => u.id === id)).toMatchObject({ firstName: 'Compte', lastName: 'supprimé', phone: '', status: 'suspended' });
    expect(after.payoutAccounts.filter((a) => a.driverId === id)).toEqual([]);
    expect(after.presence.filter((x) => x.driverId === id)).toEqual([]);
    expect(after.vehicles.filter((v) => v.driverId === id).every((v) => v.plate === '')).toBe(true);
    for (const c of after.cases.filter((x) => x.userId === id)) {
      expect(c.identity).toBeNull();
      expect(c.draft).toBeNull();
    }

    // Kept: the rides she drove (with the car, for the passenger's receipt), her ledger.
    const kept = after.rides.filter((r) => r.driverId === id);
    expect(kept.map((r) => r.id)).toEqual(driven);
    expect(kept.every((r) => r.driver?.firstName === 'Compte supprimé' && r.driver.lastInitial === '')).toBe(true);
    expect(kept.map((r) => r.driver?.vehicle.plate)).toEqual(plates);
    expect(after.ledger.filter((e) => e.driverId === id).map((e) => e.id)).toEqual(ledger);

    const appended = after.audit.slice(auditFrom);
    const event = appended.find((e) => e.action === 'account.deleted')!;
    expect(event).toMatchObject({ entityType: 'user', entityId: id, actor: { type: 'user', id, name: 'Compte supprimé' } });
    expect(event.summary).toMatch(/^Compte chauffeuse supprimé/);
    const text = JSON.stringify(appended);
    for (const pii of [PHONES.leila, 'Leila', 'Amrani']) expect(text).not.toContain(pii);
    expect(verifyAuditChain(after.audit).valid).toBe(true);

    // The same number signs up again as a new chauffeuse.
    await h.ok('POST', '/auth/otp/request', { body: { phone: PHONES.leila, role: 'driver' } });
    const fresh = await h.ok('POST', '/auth/otp/verify', { body: { phone: PHONES.leila, role: 'driver', code: '482913' } });
    expect(fresh.isNew).toBe(true);
    expect(fresh.user.id).not.toBe(id);
  });

  it('refuses with money left to withdraw and families relying on her, giving every reason', () => {
    const h = setup();
    const amina = driverByPhone(h, PHONES.amina);
    const blockers = deletionBlockers(h.ctx.store.state, amina, h.ctx.clock.iso());
    expect(blockers.map((b) => b.code)).toEqual(['wallet_balance', 'famille_assignments']);
    expect(blockers[0]!.message).toMatch(/^Il reste 70\sMAD sur votre portefeuille Naya\. Retirez ce solde ou contactez l’assistance/);
    expect(blockers[1]!.message).toContain('Contactez l’assistance');
    const refused = tryDelete(h, PHONES.amina)!;
    expect(refused.code).toBe('PENDING_OPERATION');
    expect(refused.message).toBe(blockers[0]!.message);
    expect(driverByPhone(h, PHONES.amina).firstName).toBe('Amina');
  });

  it('refuses during an accepted ride with ACTIVE_RIDE_EXISTS, and while she is online', async () => {
    const h = setup();
    const amina = await h.login(PHONES.amina, 'driver');
    await h.ok('POST', '/driver/online', { token: amina, body: { online: true } });
    const salma = await h.login(PHONES.salma, 'passenger');
    const quote = await h.ok('POST', '/quotes', { token: salma, body: { cityId: 'rabat', stops: AGDAL_TRIP } });
    const cash = (await h.ok('GET', '/payment-methods', { token: salma })).find((m: any) => m.kind === 'cash');
    await h.ok('POST', '/rides', { token: salma, body: { quoteId: quote.id, paymentMethodId: cash.id } });
    const offer = (await h.ok('GET', '/driver/status', { token: amina })).offer;
    await h.ok('POST', `/driver/offers/${offer.id}/accept`, { token: amina });

    const refused = tryDelete(h, PHONES.amina)!;
    expect(refused.code).toBe('ACTIVE_RIDE_EXISTS');
    expect(refused.message).toBe('Une course est en cours. Vous pourrez supprimer votre compte une fois la course terminée.');
    expect(refused.details?.blockers).toEqual(expect.arrayContaining(['ride_active', 'driver_online']));
  });

  it('refuses while online, then deletes once she is offline with a zero wallet', async () => {
    const h = setup();
    const nadia = await h.login(HOUDA, 'driver');
    await h.ok('POST', '/driver/online', { token: nadia, body: { online: true } });
    const refused = tryDelete(h, HOUDA)!;
    expect(refused.details?.blockers).toEqual(['driver_online']);
    expect(refused.message).toBe('Vous êtes en ligne. Passez hors ligne depuis l’accueil, puis revenez ici.');

    await h.ok('POST', '/driver/online', { token: nadia, body: { online: false } });
    expect(tryDelete(h, HOUDA)).toBeNull();
    expect((await h.call('GET', '/me', { token: nadia })).status).toBe(401);
  });

  it('refuses while a recharge is waiting for the provider', async () => {
    const h = setup();
    settle(h, PHONES.leila);
    const id = driverByPhone(h, PHONES.leila).id;
    h.ctx.store.tx((s) => {
      s.recharges.push({ id: 'RC-T1', driverId: id, cityId: 'rabat', amount: 5_000, providerId: 'p', providerName: 'p', status: 'pending', providerRef: 'r', failureReason: null, createdAt: h.ctx.clock.iso(), updatedAt: h.ctx.clock.iso() });
    });
    expect(tryDelete(h, PHONES.leila)!.details?.blockers).toEqual(['transfer_pending']);
  });
});
