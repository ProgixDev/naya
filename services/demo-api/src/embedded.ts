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

/** The same demo rules, executed directly in the app. Never starts a HTTP server. */
export function createEmbeddedDemo(options: { dataDir: string; role: MobileRole; clock?: Clock }) {
  const clock = options.clock ?? new Clock();
  const store = Store.load(join(options.dataDir, 'demo-v1.json'), () => buildSeed(options.dataDir, 'default', clock.now()));
  const ctx: Ctx = { store, clock, config: {
    devMode: true, otpMode: 'fixed', dataDir: options.dataDir,
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
    tick(ctx);
    const principal = authenticate(ctx, token ?? undefined);
    if (principal?.kind !== 'user') return;
    const user = principal.user;
    // Locally submitted demo documents receive a simulated review. Seeded review states
    // stay intact until the tester submits a new version of their dossier.
    for (const c of [...store.state.cases]) {
      if (c.userId !== user.id || c.status !== 'submitted' || !c.submittedAt ||
          Date.parse(c.submittedAt) <= Date.parse(user.createdAt) || now - Date.parse(c.submittedAt) < 3000) continue;
      const reviewer = store.state.admins[0]!;
      startReview(ctx, reviewer, c.id);
      const current = store.state.cases.find((v) => v.id === c.id)!;
      decideCase(ctx, reviewer, c.id, { outcome: 'approved', expectedVersion: current.version, reasonCode: null, message: 'Validation simulée pour cette démonstration sur votre appareil.' });
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
