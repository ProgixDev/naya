import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { PLACES, type Place } from '@naya/domain';
import { createApp } from '../src/app';
import { ManualClock } from '../src/clock';
import type { Ctx } from '../src/context';
import { buildSeed, type ScenarioId } from '../src/seed';
import { Store } from '../src/store';
import { tick } from '../src/services/timers';

export const START = '2026-10-01T08:00:00.000Z';

export function setup(scenario: ScenarioId = 'default') {
  const dataDir = mkdtempSync(join(tmpdir(), 'naya-test-'));
  const clock = new ManualClock(START);
  const store = new Store(buildSeed(dataDir, scenario, clock.now()), null);
  const ctx: Ctx = {
    store,
    clock,
    config: { devMode: true, otpMode: 'fixed', providerSecret: 'test-secret', dataDir, providerDelaySeconds: { payment: 3, withdrawalConfirm: 8, withdrawalFail: 5 } },
  };
  const app = createApp(ctx);
  let keyCounter = 0;

  async function call<T = any>(method: string, path: string, opts: { token?: string; body?: unknown; key?: string | false; headers?: Record<string, string> } = {}): Promise<{ status: number; body: T }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.key !== false && method === 'POST') headers['Idempotency-Key'] = opts.key ?? `k-${++keyCounter}`;
    const res = await app.request(path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    if (!(res.headers.get('Content-Type') ?? '').includes('json')) return { status: res.status, body: null as T };
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  async function ok<T = any>(method: string, path: string, opts: Parameters<typeof call>[2] = {}): Promise<T> {
    const r = await call<T>(method, path, opts);
    if (r.status >= 400) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  }

  async function login(phone: string, role: 'passenger' | 'driver') {
    await ok('POST', '/auth/otp/request', { body: { phone, role } });
    const r = await ok('POST', '/auth/otp/verify', { body: { phone, role, code: '123456' } });
    return r.token as string;
  }

  async function adminLogin(email = 'meryem@naya.demo', password = 'Naya-Admin-2026') {
    return (await ok('POST', '/admin/auth/login', { body: { email, password } })).token as string;
  }

  function advance(seconds: number) {
    clock.advance(seconds);
    tick(ctx);
  }

  function sign(body: string) {
    return createHmac('sha256', 'test-secret').update(body).digest('hex');
  }

  return { ctx, app, call, ok, login, adminLogin, advance, sign, clock };
}

export const PHONES = {
  salma: '+212612345678',
  nour: '+212623456789',
  imane: '+212634567890',
  rania: '+212645678901',
  hiba: '+212656789012',
  amina: '+212661234567',
  khadija: '+212662345678',
  nadia: '+212663456789',
  leila: '+212664567890',
  samira: '+212665678901',
};

export const AGDAL_TRIP: Place[] = [PLACES.gareRabatVille, PLACES.agdal, PLACES.hayRiad];

/** Fake JPEG bytes: valid magic number, enough for content sniffing. */
export const JPEG_B64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]).toString('base64');
