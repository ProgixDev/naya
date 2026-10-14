import { PLACES, isRideActive, type MobileRole } from '@naya/domain';
import { createApp } from './app';
import { Clock } from './clock';
import type { Ctx } from './context';
import { buildSeed } from './seed';
import { Store } from './store';
import { join } from './platform';
import { authenticate } from './services/auth';
import { createQuote, createRide, driverEligibility } from './services/rides';
import { decideCase, startReview } from './services/verification';
import { tick } from './services/timers';
import { readUpload, uploadDir } from './services/uploads';

/** The on-device reviewer takes a newly submitted dossier up after this long, like a review queue. */
export const REVIEW_PICKUP_MS = 6_000;

/**
 * Time from submission to the on-device reviewer's decision: 20–40 s, derived from the case and
 * its submission time so it stays the same across app restarts.
 */
export function reviewDelayMs(c: { id: string; submittedAt: string | null }) {
  let h = 0;
  for (const ch of `${c.id}:${c.submittedAt ?? ''}`) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return 20_000 + (h % 20_001);
}

/** The same demo rules, executed directly in the app. Never starts a HTTP server. */
export function createEmbeddedDemo(options: { dataDir: string; role: MobileRole; clock?: Clock }) {
  const clock = options.clock ?? new Clock();
  const store = Store.load(join(options.dataDir, 'demo-v1.json'), () => buildSeed(options.dataDir, 'default', clock.now()));
  const ctx: Ctx = { store, clock, config: {
    devMode: true, otpMode: 'any', dataDir: options.dataDir,
    providerSecret: 'on-device-fictional-demo',
    providerDelaySeconds: { payment: 3, withdrawalConfirm: 8, withdrawalFail: 5 },
  } };
  const app = createApp(ctx, { embedded: true });
  let nextOfferAt = clock.now() + 5000;
  let queue: Promise<unknown> = Promise.resolve();

  function advanceDemo(token: string | null) {
    const s = store.state;
    const now = clock.now();
    // Passenger trips have a simulated counterpart; no second phone is required.
    const bot = s.presence.find((p) => p.bot);
    if (bot && bot.online !== (options.role === 'passenger')) {
      store.tx(() => { bot.online = options.role === 'passenger'; bot.updatedAt = clock.iso(); });
    }
    const principal = authenticate(ctx, token ?? undefined);
    // Naya Famille: the other side of a family trip is simulated on this device. The passenger
    // app gets a simulated chauffeuse; the driver app a simulated parent who approves the start.
    // Choices made in the scenario launcher (trip.demo already set) are kept.
    if (principal?.kind === 'user') {
      const me = principal.user;
      const unset = (s.prototype?.trips ?? []).filter((t) => t.demo === undefined && (me.role === 'passenger' ? t.passengerId === me.id : t.driverId === me.id));
      if (unset.length && me.role === options.role) {
        store.tx(() => { for (const t of unset) t.demo = options.role === 'passenger' ? { driver: true, parent: null } : { driver: false, parent: 'approve' }; });
      }
    }
    tick(ctx);
    if (principal?.kind !== 'user') return;
    const user = principal.user;
    // Standalone builds have no admin console, so an on-device reviewer examines the dossiers
    // submitted on this phone: it takes one up after REVIEW_PICKUP_MS (« en cours d’examen ») and
    // approves it reviewDelayMs after submission, so the app first shows the normal pending state.
    // Corrections and refusals only come from a person in the admin console (connected mode).
    // A dossier submitted when its account was created (seeded Nour) stays pending; seeded
    // dossiers sent later than that (Khadija's vehicle, Houda's Famille application) and every
    // dossier sent on this phone are reviewed, and a decided dossier is never touched again.
    // Without an admin allowed to decide, nothing is reviewed (a throw here would fail every request).
    const reviewer = store.state.admins.find((a) => a.permissions.includes('verification.decide'));
    for (const c of [...store.state.cases]) {
      if (!reviewer || c.userId !== user.id || (c.status !== 'submitted' && c.status !== 'in_review') || !c.submittedAt ||
          Date.parse(c.submittedAt) <= Date.parse(user.createdAt)) continue;
      const waited = now - Date.parse(c.submittedAt);
      if (waited < REVIEW_PICKUP_MS) continue;
      if (c.status === 'submitted') startReview(ctx, reviewer, c.id);
      if (waited < reviewDelayMs(c)) continue;
      const current = store.state.cases.find((v) => v.id === c.id)!;
      decideCase(ctx, reviewer, c.id, { outcome: 'approved', expectedVersion: current.version, reasonCode: null, message: '' });
    }
    if (options.role !== 'driver' || user.role !== 'driver') return;
    const online = store.state.presence.find((p) => p.driverId === user.id)?.online;
    const occupied = store.state.rides.some((r) => r.driverId === user.id && isRideActive(r.status)) ||
      store.state.offers.some((o) => o.driverId === user.id && o.status === 'pending') ||
      store.state.payments.some((p) => p.status === 'pending' && store.state.rides.some((r) => r.id === p.rideId && r.driverId === user.id));
    if (!online || occupied) { nextOfferAt = now + 7000; return; }
    if (now < nextOfferAt || !driverEligibility(store.state, user, clock.iso()).eligible) return;
    const passenger = store.state.users.find((p) => p.phone === '+212612345678' && p.role === 'passenger')!;
    if (store.state.rides.some((r) => r.passengerId === passenger.id && isRideActive(r.status))) return;
    const quote = createQuote(ctx, passenger, 'rabat', [PLACES.gareRabatVille, PLACES.agdal, PLACES.hayRiad]);
    const payment = store.state.paymentMethods.find((p) => p.userId === passenger.id && p.kind === 'cash')!;
    createRide(ctx, passenger, quote.id, payment.id);
    nextOfferAt = now + 30_000;
  }

  return {
    /** Serialized requests preserve transactions and idempotency even with parallel queries. */
    fetch(url: string, init: RequestInit = {}): Promise<Response> {
      const task = queue.then(async () => {
        const token = new Headers(init.headers).get('Authorization');
        advanceDemo(token);
        return app.request(url, init);
      });
      queue = task.catch(() => undefined);
      return task;
    },
    uploadUrl(id: string, token: string | null) {
      const principal = authenticate(ctx, token ?? undefined);
      if (!principal) return '';
      const { upload } = readUpload(ctx, principal, id);
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'image/svg+xml': 'svg' }[upload.mimeType];
      return join(uploadDir(ctx), `${id}.${extension}`);
    },
  };
}
