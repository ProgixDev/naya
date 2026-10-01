import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiClient } from '../../../packages/api/src/client';
import { PLACES, mad } from '@naya/domain';
import { createEmbeddedDemo } from '../src/embedded';
import { ManualClock } from '../src/clock';

const folders: string[] = [];
afterEach(() => { vi.unstubAllGlobals(); for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true }); });
function setup(role: 'passenger' | 'driver') {
  const folder = mkdtempSync(join(tmpdir(), 'naya-embedded-')); folders.push(folder);
  const clock = new ManualClock('2026-10-01T10:00:00.000Z');
  let runtime = createEmbeddedDemo({ dataDir: folder, role, clock });
  let token: string | null = null;
  const network = vi.fn(() => { throw new Error('Network must not be used by the demo'); });
  vi.stubGlobal('fetch', network);
  const client = createApiClient({ baseUrl: 'https://demo.naya.local', getToken: () => token,
    transport: (url, init) => runtime.fetch(url, init), uploadUrl: (id) => runtime.uploadUrl(id, token) });
  return { client, clock, network,
    restart: () => { runtime = createEmbeddedDemo({ dataDir: folder, role, clock }); },
    login: async (phone = role === 'passenger' ? '+212612345678' : '+212661234567') => {
      const otp = await client.auth.requestOtp(phone, role);
      expect(otp.demoCode).toBe('123456');
      const login = await client.auth.verifyOtp(phone, role, otp.demoCode!); token = login.token; return login;
    },
  };
}

describe('standalone demo with all network calls blocked', () => {
  it('preserves JSON bodies with React Native’s non-streaming Response implementation', async () => {
    const BaseResponse = Response;
    vi.stubGlobal('Response', class extends BaseResponse {
      constructor(body?: BodyInit | null, init?: ResponseInit) {
        super(body, init);
        Object.defineProperty(this, 'body', { value: undefined });
      }
    });
    const h = setup('passenger');
    await expect(h.client.me.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    await h.login();
    expect((await h.client.me.get()).user.firstName).toBe('Salma');
    expect(h.network).not.toHaveBeenCalled();
  });

  it('simulates review of a newly submitted dossier while preserving seeded pending accounts', async () => {
    const h = setup('passenger'); await h.login('+212623456789');
    h.clock.advance(10);
    expect((await h.client.verification.list()).cases[0]?.status).toBe('submitted');
    await h.login('+212677000099');
    const dossier = (await h.client.verification.list()).cases[0]!;
    await h.client.verification.saveIdentity(dossier.id, { firstName: 'Yasmine', lastName: 'Démo', birthDate: '1998-05-01', documentType: 'cin', documentNumber: 'AA112233' });
    for (const key of ['selfie', 'id_front', 'id_back'] as const) {
      const upload = await h.client.dev.sampleUpload(key);
      await h.client.verification.setItem(dossier.id, key, [upload.id]);
    }
    h.clock.advance(1);
    expect((await h.client.verification.submit(dossier.id)).status).toBe('submitted');
    h.restart(); h.clock.advance(4);
    expect((await h.client.verification.list()).cases[0]?.status).toBe('approved');
    expect(h.network).not.toHaveBeenCalled();
  });

  it('signs in an arbitrary number, preserves profile/session after restart, and serves local documents', async () => {
    const h = setup('passenger');
    const login = await h.login('+212654279884');
    expect(login.isNew).toBe(true);
    await h.client.me.update({ firstName: 'Naya', lastName: 'Démo' });
    const upload = await h.client.dev.sampleUpload('id_front');
    expect(existsSync(h.client.uploadUrl(upload.id))).toBe(true);
    h.restart();
    expect((await h.client.me.get()).user.firstName).toBe('Naya');
    expect(existsSync(h.client.uploadUrl(upload.id))).toBe(true);
    expect(h.network).not.toHaveBeenCalled();
  });

  it('runs a passenger trip to completion using a local simulated driver', async () => {
    const h = setup('passenger'); await h.login();
    const quote = await h.client.quotes.create('rabat', [PLACES.gareRabatVille, PLACES.agdal]);
    const cash = (await h.client.paymentMethods.list()).find((p) => p.kind === 'cash')!;
    const ride = await h.client.rides.create(quote.id, cash.id, 'offline-passenger-ride');
    h.clock.advance(4);
    expect((await h.client.rides.get(ride.id)).ride.status).toBe('driver_assigned');
    h.clock.advance(16); await h.client.rides.get(ride.id);
    h.clock.advance(9); await h.client.rides.get(ride.id);
    h.clock.advance(200); await h.client.rides.get(ride.id);
    const detail = await h.client.rides.get(ride.id);
    expect(detail.ride.status).toBe('completed');
    expect(detail.payments[0]?.status).toBe('confirmed');
    await h.client.rides.rate(ride.id, 5, 'Démo fluide');
    expect(h.network).not.toHaveBeenCalled();
  });

  it('generates a driver offer without another app and settles a complete cash trip', async () => {
    const h = setup('driver'); await h.login();
    await h.client.driver.setOnline(true, { lat: 34.0205, lng: -6.831 });
    h.clock.advance(8);
    const status = await h.client.driver.status();
    expect(status.offer?.status).toBe('pending');
    const ride = await h.client.driver.acceptOffer(status.offer!.id, 'offline-driver-accept');
    await h.client.driver.arrive(ride.id);
    await h.client.driver.start(ride.id);
    await h.client.driver.completeStop(ride.id);
    await h.client.driver.complete(ride.id);
    await h.client.driver.cashCollected(ride.id, ride.terms.breakdown.total);
    expect((await h.client.driver.wallet()).wallet.balance).toBe(mad(55));
    h.restart();
    expect((await h.client.driver.wallet()).wallet.balance).toBe(mad(55));
    expect(h.network).not.toHaveBeenCalled();
  });

  it('persists a pending withdrawal and completes it after restart without double debiting', async () => {
    const h = setup('driver'); await h.login();
    const wallet = await h.client.driver.wallet();
    const payout = wallet.payoutAccounts[0]!;
    const withdrawal = await h.client.driver.withdraw(mad(50), payout.id, 'offline-withdraw');
    h.restart(); h.clock.advance(10);
    expect((await h.client.driver.getWithdrawal(withdrawal.id)).status).toBe('confirmed');
    expect((await h.client.driver.wallet()).wallet.balance).toBe(mad(20));
    await h.client.driver.withdraw(mad(50), payout.id, 'offline-withdraw');
    expect((await h.client.driver.wallet()).wallet.balance).toBe(mad(20));
    expect(h.network).not.toHaveBeenCalled();
  });

  it('creates, changes and cancels a scheduled booking locally', async () => {
    const h = setup('passenger'); await h.login();
    const quote = await h.client.quotes.create('rabat', [PLACES.gareRabatVille, PLACES.agdal]);
    const cash = (await h.client.paymentMethods.list()).find((p) => p.kind === 'cash')!;
    const booking = await h.client.scheduled.create(quote.id, cash.id, new Date(h.clock.now() + 3600000).toISOString(), 'offline-scheduled');
    await h.client.scheduled.modify(booking.id, new Date(h.clock.now() + 7200000).toISOString());
    await h.client.scheduled.cancel(booking.id, 'plans_changed');
    h.restart(); expect((await h.client.scheduled.get(booking.id)).status).toBe('cancelled');
    expect(h.network).not.toHaveBeenCalled();
  });
});
