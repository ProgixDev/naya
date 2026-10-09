import { createHash, readFileSync, fixturePath } from './platform';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { ZodError, type ZodType } from 'zod';
import type { UploadInput } from '@naya/domain';
import {
  adminLoginSchema,
  cancelSchema,
  cashCollectedSchema,
  cityStatusSchema,
  correctionSchema,
  createCitySchema,
  createRideSchema,
  declineOfferSchema,
  decisionSchema,
  DomainError,
  ERROR_MESSAGES,
  goOnlineSchema,
  haversineMeters,
  httpStatusFor,
  identityDetailsSchema,
  isDomainError,
  isRideActive,
  locationUpdateSchema,
  modifyScheduledSchema,
  otpRequestSchema,
  otpVerifySchema,
  PLACES,
  profileUpdateSchema,
  providerCallbackSchema,
  providerToggleSchema,
  quoteRequestSchema,
  ratingSchema,
  rechargeSchema,
  resolveTicketSchema,
  agentMessageSchema,
  ticketActionSchema,
  ticketStatusSchema,
  savedPlaceSchema,
  scheduleRideSchema,
  supportMessageSchema,
  supportTicketSchema,
  tokenizedCardSchema,
  updateRulesSchema,
  uploadSchema,
  vehicleDetailsSchema,
  verificationItemKeySchema,
  withdrawalSchema,
  zoneSchema,
  reasonSchema,
  type AdminUser,
  type Place,
  type User,
} from '@naya/domain';
import type { Ctx } from './context';
import type { State } from './state';
import { mustFind, nextId } from './store';
import { appendAudit, verifyAuditChain } from './audit';
import { adminLogin, authenticate, logout, requestOtp, verifyOtp, type Principal } from './services/auth';
import { createUpload, readUpload } from './services/uploads';
import { casesForUser, decideCase, ensureVehicleCase, reopenCase, saveDetails, setItem, startReview, submitCase, REJECTION_REASONS, RECOVERABLE_REJECTIONS } from './services/verification';
import {
  acceptOffer,
  cancelScheduled,
  cancellationPreview,
  confirmCashCollected,
  createQuote,
  createRide,
  currentOfferFor,
  declineOffer,
  dispatchCity,
  driverArrive,
  driverCancel,
  driverComplete,
  driverCompleteStop,
  driverEligibility,
  driverStart,
  modifyScheduled,
  passengerCancel,
  rateRide,
  retryPayment,
  retrySearch,
  scheduleRide,
  setOnline,
  updateLocation,
  withTracking,
} from './services/rides';
import { applyProviderEvent, createCorrection, createRecharge, createWithdrawal, earningsOf, resolveManually, verifySignature, walletOf } from './services/finance';
import { addZone, createCity, setCityStatus, setZoneActive, toggleProvider, updateRules } from './services/cities';
import { ensurePrototype } from './services/prototype';
import { agentMessage, createTicket, publicTicket, recordTicketAction, resolveTicket, setTicketStatus, userMessage } from './services/support';
import { requirePermission } from './services/permissions';
import { tick } from './services/timers';
import { mountPrototypeRoutes, prototypeMethods, prototypeProviders } from './services/prototype';
import { buildSeed, DEMO_ACCOUNTS, SCENARIOS, type ScenarioId } from './seed';

type Env = { Variables: { principal: Principal | null } };

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

async function body<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new DomainError('VALIDATION', 'Corps de requête invalide.');
  }
  return schema.parse(raw);
}

function userOf(c: Context<Env>, role?: 'passenger' | 'driver'): User {
  const p = c.get('principal');
  if (!p) throw new DomainError('UNAUTHORIZED');
  if (p.kind !== 'user' || (role && p.user.role !== role)) throw new DomainError('FORBIDDEN');
  return p.user;
}

function adminOf(c: Context<Env>): AdminUser {
  const p = c.get('principal');
  if (!p) throw new DomainError('UNAUTHORIZED');
  if (p.kind !== 'admin') throw new DomainError('FORBIDDEN');
  return p.admin;
}

/**
 * Idempotent POST: the same key and body replay the original response; the same key with a
 * different body is refused. Financial and booking actions require a key.
 */
async function idempotent<T>(ctx: Ctx, c: Context<Env>, subjectId: string, rawBody: unknown, run: () => T, required = true): Promise<T> {
  const key = c.req.header('Idempotency-Key');
  if (!key) {
    if (required) throw new DomainError('VALIDATION', 'En-tête Idempotency-Key requis.');
    return run();
  }
  const route = `${c.req.method} ${c.req.path}`;
  const bodyHash = sha(JSON.stringify(rawBody ?? null));
  const existing = ctx.store.state.idempotency.find((r) => r.key === key && r.subjectId === subjectId);
  if (existing) {
    if (existing.bodyHash !== bodyHash || existing.route !== route) throw new DomainError('IDEMPOTENCY_CONFLICT');
    return existing.response as T;
  }
  const result = run();
  ctx.store.tx((s) => {
    s.idempotency.push({ key, subjectId, route, bodyHash, status: 200, response: result, at: ctx.clock.iso() });
    if (s.idempotency.length > 2000) s.idempotency.splice(0, s.idempotency.length - 2000);
  });
  return result;
}

const normalize = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function publicCity(s: State, cityId: string) {
  const city = mustFind(s.cities, (c) => c.id === cityId, 'ville');
  return {
    id: city.id,
    name: city.name,
    status: city.status,
    center: city.center,
    rulesVersion: city.rulesVersion,
    zones: s.zones.filter((z) => z.cityId === city.id && z.active),
    cancellation: city.rules.cancellation,
    dynamic: city.rules.dynamic.enabled ? { multiplierBp: city.rules.dynamic.multiplierBp, reason: city.rules.dynamic.reason } : null,
    scheduling: city.rules.scheduling,
    offerTimeoutSeconds: city.rules.offerTimeoutSeconds,
    debtLimit: city.rules.debtLimit,
    commissionBp: city.rules.commissionBp,
    minimumWithdrawal: city.rules.minimumWithdrawal,
  };
}

function driverStatus(ctx: Ctx, driver: User) {
  const s = ctx.store.state;
  const now = ctx.clock.now();
  const at = new Date(now).toISOString();
  const presence = s.presence.find((p) => p.driverId === driver.id) ?? null;
  const offer = currentOfferFor(s, driver.id);
  const activeRide = s.rides.find((r) => r.driverId === driver.id && ['driver_assigned', 'driver_arrived', 'in_progress'].includes(r.status));
  const unpaidCash = s.rides.find((r) => r.driverId === driver.id && r.status === 'completed' && r.paymentMethod.kind === 'cash' && s.payments.find((p) => p.id === r.paymentId)?.status === 'pending');
  return {
    online: presence?.online ?? false,
    presence,
    eligibility: driverEligibility(s, driver, at),
    wallet: walletOf(s, driver.id, at),
    /** Most recent offer; clients show it while pending and briefly after a terminal state. */
    offer: offer && (offer.status === 'pending' || now - Date.parse(offer.respondedAt ?? offer.createdAt) < 60_000) ? offer : null,
    activeRide: activeRide ? withTracking(s, activeRide, now) : null,
    awaitingCashRide: unpaidCash ?? null,
    city: publicCity(s, driver.cityId),
  };
}

function paginate<T>(items: T[], c: Context) {
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)));
  const cursor = Math.max(0, Number(c.req.query('cursor') ?? 0));
  const page = items.slice(cursor, cursor + limit);
  return { items: page, nextCursor: cursor + limit < items.length ? cursor + limit : null, total: items.length };
}

export function createApp(ctx: Ctx, options: { embedded?: boolean } = {}) {
  const app = new Hono<Env>();
  const S = () => ctx.store.state;
  const now = () => ctx.clock.now();

  // In-process native requests have no browser origin. RN's Response also has no
  // streaming `body`, so middleware must not reconstruct it from response.body.
  if (!options.embedded) app.use('*', cors({ origin: (o) => o ?? '*', allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Naya-Signature'], exposeHeaders: ['X-Server-Time'], maxAge: 600 }));
  app.use('*', async (c, next) => {
    c.set('principal', authenticate(ctx, c.req.header('Authorization')));
    c.header('X-Server-Time', ctx.clock.iso());
    c.header('Cache-Control', 'no-store');
    await next();
  });

  app.onError((err, c) => {
    if (isDomainError(err)) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details ?? null } }, httpStatusFor(err.code) as 400);
    }
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message;
      return c.json({ error: { code: 'VALIDATION', message: ERROR_MESSAGES.VALIDATION, details: { fields } } }, 422);
    }
    console.error('[api] unexpected', err);
    return c.json({ error: { code: 'UNKNOWN', message: ERROR_MESSAGES.UNKNOWN, details: null } }, 500);
  });

  mountPrototypeRoutes(app, ctx, { userOf, adminOf, idempotent });

  app.get('/health', (c) => c.json({ ok: true, version: S().version, scenario: S().scenario, devMode: ctx.config.devMode, time: ctx.clock.iso() }));
  app.get('/sync', (c) => c.json({ version: S().version, time: ctx.clock.iso() }));

  /* ───────── Auth ───────── */
  app.post('/auth/otp/request', async (c) => {
    const { phone, role } = await body(c, otpRequestSchema);
    return c.json(requestOtp(ctx, phone, role));
  });
  app.post('/auth/otp/verify', async (c) => {
    const { phone, role, code } = await body(c, otpVerifySchema);
    const r = verifyOtp(ctx, phone, role, code);
    return c.json({ token: r.token, isNew: r.isNew, user: mustFind(S().users, (u) => u.id === r.userId) });
  });
  app.post('/auth/logout', (c) => {
    logout(ctx, c.req.header('Authorization'));
    return c.json({ ok: true });
  });
  app.get('/auth/providers', (c) =>
    c.json({
      phone: true,
      // Social sign-in needs provider credentials and server-side token verification. None are configured in the demo.
      apple: process.env.NAYA_APPLE_AUTH_CONFIGURED === '1',
      google: process.env.NAYA_GOOGLE_AUTH_CONFIGURED === '1',
    }),
  );

  /* ───────── Profile ───────── */
  app.get('/me', (c) => {
    const user = userOf(c);
    const s = S();
    return c.json({ user, cases: casesForUser(s, user), vehicle: s.vehicles.find((v) => v.id === user.vehicleId) ?? null, city: publicCity(s, user.cityId), recoverableRejections: RECOVERABLE_REJECTIONS });
  });
  app.patch('/me', async (c) => {
    const user = userOf(c);
    const input = await body(c, profileUpdateSchema);
    return c.json(
      ctx.store.tx((s) => {
        const u = mustFind(s.users, (x) => x.id === user.id);
        if (input.cityId) mustFind(s.cities, (x) => x.id === input.cityId && x.status !== 'inactive', 'ville');
        if (input.firstName) u.firstName = input.firstName;
        if (input.lastName) u.lastName = input.lastName;
        if (input.cityId) u.cityId = input.cityId;
        if (input.notifications) u.notifications = { ...u.notifications, ...input.notifications };
        return u;
      }),
    );
  });
  app.post('/me/places', async (c) => {
    const user = userOf(c, 'passenger');
    const input = await body(c, savedPlaceSchema);
    return c.json(
      ctx.store.tx((s) => {
        const u = mustFind(s.users, (x) => x.id === user.id);
        if (input.kind !== 'other') u.savedPlaces = u.savedPlaces.filter((p) => p.kind !== input.kind);
        if (u.savedPlaces.length >= 10) throw new DomainError('VALIDATION', '10 adresses maximum.');
        u.savedPlaces.push({ id: nextId(s, 'SP'), ...input });
        return u;
      }),
    );
  });
  app.delete('/me/places/:id', (c) => {
    const user = userOf(c, 'passenger');
    return c.json(
      ctx.store.tx((s) => {
        const u = mustFind(s.users, (x) => x.id === user.id);
        u.savedPlaces = u.savedPlaces.filter((p) => p.id !== c.req.param('id'));
        return u;
      }),
    );
  });

  /* ───────── Uploads and verification ───────── */
  app.post('/uploads', async (c) => {
    const p = c.get('principal');
    if (!p || p.kind !== 'user') throw new DomainError('UNAUTHORIZED');
    return c.json(createUpload(ctx, p.user.id, await body(c, uploadSchema)));
  });
  app.get('/uploads/:id/preview', (c) => {
    const principal = c.get('principal'); if (!principal) throw new DomainError('UNAUTHORIZED');
    const { upload, data } = readUpload(ctx, principal, c.req.param('id'));
    return c.json({ uri: `data:${upload.mimeType};base64,${data.toString('base64')}`, mimeType: upload.mimeType }, 200, { 'Cache-Control': 'no-store' });
  });
  app.get('/uploads/:id', (c) => {
    const p = c.get('principal');
    if (!p) throw new DomainError('UNAUTHORIZED');
    const { upload, data } = readUpload(ctx, p, c.req.param('id'));
    return c.body(new Uint8Array(data), 200, { 'Content-Type': upload.mimeType, 'Cache-Control': 'private, max-age=300' });
  });
  app.get('/verification', (c) => {
    const user = userOf(c);
    return c.json({ cases: casesForUser(S(), user), rejectionReasons: REJECTION_REASONS, recoverableRejections: RECOVERABLE_REJECTIONS });
  });
  app.post('/verification/vehicle', (c) => c.json(ensureVehicleCase(ctx, userOf(c, 'driver'))));
  app.put('/verification/:id/identity', async (c) => c.json(saveDetails(ctx, userOf(c), c.req.param('id'), { identity: await body(c, identityDetailsSchema) })));
  app.put('/verification/:id/vehicle', async (c) => c.json(saveDetails(ctx, userOf(c, 'driver'), c.req.param('id'), { vehicle: await body(c, vehicleDetailsSchema) })));
  app.put('/verification/:id/items/:key', async (c) => {
    const key = verificationItemKeySchema.parse(c.req.param('key'));
    const { uploadIds } = (await c.req.json()) as { uploadIds: string[] };
    return c.json(setItem(ctx, userOf(c), c.req.param('id'), key, uploadIds));
  });
  app.post('/verification/:id/submit', (c) => c.json(submitCase(ctx, userOf(c), c.req.param('id'))));
  app.post('/verification/:id/reopen', (c) => c.json(reopenCase(ctx, userOf(c), c.req.param('id'))));

  /* ───────── Cities and places ───────── */
  app.get('/cities', (c) => {
    const s = S();
    return c.json(s.cities.filter((x) => x.status !== 'inactive').map((x) => publicCity(s, x.id)));
  });
  app.get('/places/search', (c) => {
    const q = normalize(c.req.query('q') ?? '');
    const cityId = c.req.query('cityId') ?? 'rabat';
    const city = mustFind(S().cities, x => x.id === cityId, 'ville');
    const prefix = cityId === 'casablanca' ? 'casa' : cityId;
    const generated: Place[] = ['Centre-ville', 'Gare', 'École', 'Quartier résidentiel', 'Hôpital', 'Aéroport'].map((label, i) => ({ id: `${cityId}-demo-${i}`, label: `${city.name} · ${label}`, address: `${label}, ${city.name} (démo)`, location: { lat: city.center.lat + i * 0.0015, lng: city.center.lng + i * 0.001 } }));
    const all = ['rabat', 'casablanca'].includes(cityId) ? Object.values(PLACES) as Place[] : generated;
    const results = all.filter((p) => (p.id?.startsWith(prefix) || (cityId === 'rabat' && p.id?.startsWith('sale'))) && (!q || normalize(`${p.label} ${p.address}`).includes(q)));
    return c.json(results.slice(0, 8));
  });
  app.get('/places/reverse', (c) => {
    const lat = Number(c.req.query('lat'));
    const lng = Number(c.req.query('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new DomainError('VALIDATION');
    const nearest = (Object.values(PLACES) as Place[]).map((p) => ({ p, d: haversineMeters(p.location, { lat, lng }) })).sort((a, b) => a.d - b.d)[0]!;
    const place: Place = { id: null, label: nearest.d < 150 ? nearest.p.label : `Près de ${nearest.p.label}`, address: nearest.d < 150 ? nearest.p.address : `Point choisi sur la carte · ${Math.round(nearest.d)} m de ${nearest.p.label}`, location: { lat, lng } };
    return c.json(place);
  });

  /* ───────── Passenger rides ───────── */
  app.post('/quotes', async (c) => {
    const input = await body(c, quoteRequestSchema);
    return c.json(createQuote(ctx, userOf(c, 'passenger'), input.cityId, input.stops, input.categoryId));
  });
  app.get('/payment-methods', (c) => {
    const user = userOf(c, 'passenger');
    const s = S();
    const proto = prototypeMethods(s, user);
    const methods = s.paymentMethods.filter((p) => p.userId === user.id);
    const available = new Set(s.providers.filter((p) => p.cityId === user.cityId && p.purpose === 'ride' && p.enabled && p.configured).map((p) => p.kind));
    return c.json(methods.map(({ providerToken: _t, ...m }) => ({ ...m, availableInCity: m.kind === 'wallet' || (m.kind === 'mobile_wallet' ? proto.catalog.payments.some(p => p.kind === 'mobile' && p.enabled && (!p.cityIds.length || p.cityIds.includes(user.cityId))) : available.has(m.kind)) })));
  });
  app.post('/payment-methods/card', async (c) => {
    const user = userOf(c, 'passenger');
    const input = await body(c, tokenizedCardSchema);
    if (!/^tok_demo_\d{4}$/.test(input.providerToken)) throw new DomainError('VALIDATION', 'Jeton de carte invalide.');
    return c.json(
      ctx.store.tx((s) => {
        const last4 = input.providerToken.slice(-4);
        if (s.paymentMethods.some((p) => p.userId === user.id && p.providerToken === input.providerToken)) throw new DomainError('CONFLICT', 'Cette carte est déjà enregistrée.');
        if (input.makeDefault) for (const p of s.paymentMethods.filter((x) => x.userId === user.id)) p.isDefault = false;
        const pm = { id: nextId(s, 'PM'), userId: user.id, kind: 'card' as const, label: `Carte de démonstration •••• ${last4}`, providerToken: input.providerToken, last4, expMonth: 12, expYear: 2029, isDefault: input.makeDefault };
        s.paymentMethods.push(pm);
        const { providerToken: _t, ...safe } = pm;
        return safe;
      }),
    );
  });
  app.post('/payment-methods/:id/default', (c) => {
    const user = userOf(c, 'passenger');
    return c.json(
      ctx.store.tx((s) => {
        const pm = mustFind(s.paymentMethods, (p) => p.id === c.req.param('id') && p.userId === user.id, 'moyen de paiement');
        for (const p of s.paymentMethods.filter((x) => x.userId === user.id)) p.isDefault = p === pm;
        return { ok: true };
      }),
    );
  });
  app.delete('/payment-methods/:id', (c) => {
    const user = userOf(c, 'passenger');
    return c.json(
      ctx.store.tx((s) => {
        const pm = mustFind(s.paymentMethods, (p) => p.id === c.req.param('id') && p.userId === user.id, 'moyen de paiement');
        if (pm.kind !== 'card') throw new DomainError('VALIDATION', 'Les espèces ne peuvent pas être supprimées.');
        if (s.rides.some((r) => r.paymentMethod.id === pm.id && isRideActive(r.status)) || s.scheduled.some((b) => b.paymentMethod.id === pm.id && b.status === 'scheduled')) {
          throw new DomainError('CONFLICT', 'Cette carte est utilisée par une course en cours ou planifiée.');
        }
        s.paymentMethods = s.paymentMethods.filter((p) => p !== pm);
        if (pm.isDefault) {
          const cash = s.paymentMethods.find((p) => p.userId === user.id && p.kind === 'cash');
          if (cash) cash.isDefault = true;
        }
        return { ok: true };
      }),
    );
  });

  app.post('/rides', async (c) => {
    const user = userOf(c, 'passenger');
    const input = await body(c, createRideSchema);
    return c.json(await idempotent(ctx, c, user.id, input, () => withTracking(S(), createRide(ctx, user, input.quoteId, input.paymentMethodId), now())));
  });
  app.get('/rides/active', (c) => {
    const user = userOf(c, 'passenger');
    const s = S();
    const ride = s.rides.filter((r) => r.passengerId === user.id && (isRideActive(r.status) || r.status === 'no_driver')).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
    return c.json(ride ? withTracking(s, ride, now()) : null);
  });
  app.get('/rides', (c) => {
    const user = userOf(c);
    const s = S();
    const rides = s.rides
      .filter((r) => (user.role === 'passenger' ? r.passengerId === user.id : r.driverId === user.id))
      .filter((r) => r.status === 'completed' || r.status === 'cancelled')
      .sort((a, b) => (b.completedAt ?? b.cancellation?.at ?? b.requestedAt).localeCompare(a.completedAt ?? a.cancellation?.at ?? a.requestedAt));
    return c.json(paginate(rides, c));
  });
  app.get('/rides/:id', (c) => {
    const user = userOf(c);
    const s = S();
    const ride = mustFind(s.rides, (r) => r.id === c.req.param('id'), 'course');
    const involved = ride.passengerId === user.id || ride.driverId === user.id || ride.driverCancellations.some((d) => d.driverId === user.id) || s.offers.some((o) => o.rideId === ride.id && o.driverId === user.id);
    if (!involved) throw new DomainError('FORBIDDEN');
    const payments = s.payments.filter((p) => p.rideId === ride.id);
    // A driver who cancelled or was not assigned sees only her own involvement.
    if (user.role === 'driver' && ride.driverId !== user.id) {
      return c.json({ ride: { ...ride, passenger: { ...ride.passenger }, driverLocation: null, timeline: [] }, payments: [] });
    }
    return c.json({ ride: withTracking(s, ride, now()), payments });
  });
  app.get('/rides/:id/cancellation-preview', (c) => c.json(cancellationPreview(ctx, userOf(c, 'passenger'), c.req.param('id'))));
  app.post('/rides/:id/cancel', async (c) => {
    const user = userOf(c, 'passenger');
    const input = await body(c, cancelSchema);
    return c.json(await idempotent(ctx, c, user.id, input, () => passengerCancel(ctx, user, c.req.param('id'), input), false));
  });
  app.post('/rides/:id/retry-search', (c) => c.json(retrySearch(ctx, userOf(c, 'passenger'), c.req.param('id'))));
  app.post('/rides/:id/rating', async (c) => {
    const input = await body(c, ratingSchema);
    return c.json(rateRide(ctx, userOf(c, 'passenger'), c.req.param('id'), input.stars, input.comment));
  });
  app.post('/rides/:id/payment/retry', async (c) => {
    const user = userOf(c, 'passenger');
    const { paymentMethodId } = (await c.req.json()) as { paymentMethodId: string };
    return c.json(await idempotent(ctx, c, user.id, { paymentMethodId }, () => retryPayment(ctx, user, c.req.param('id'), paymentMethodId)));
  });

  /* ───────── Scheduled ───────── */
  app.post('/scheduled', async (c) => {
    const user = userOf(c, 'passenger');
    const input = await body(c, scheduleRideSchema);
    return c.json(await idempotent(ctx, c, user.id, input, () => scheduleRide(ctx, user, input.quoteId, input.paymentMethodId, input.pickupAt)));
  });
  app.get('/scheduled', (c) => {
    const user = userOf(c, 'passenger');
    return c.json(S().scheduled.filter((b) => b.passengerId === user.id).sort((a, b) => a.pickupAt.localeCompare(b.pickupAt)));
  });
  app.get('/scheduled/:id', (c) => {
    const user = userOf(c, 'passenger');
    const b = mustFind(S().scheduled, (x) => x.id === c.req.param('id') && x.passengerId === user.id, 'réservation');
    return c.json(b);
  });
  app.patch('/scheduled/:id', async (c) => c.json(modifyScheduled(ctx, userOf(c, 'passenger'), c.req.param('id'), await body(c, modifyScheduledSchema))));
  app.post('/scheduled/:id/cancel', async (c) => {
    const input = await body(c, cancelSchema);
    return c.json(cancelScheduled(ctx, userOf(c, 'passenger'), c.req.param('id'), input.reasonCode, input.reasonText));
  });

  /* ───────── Driver ───────── */
  app.get('/driver/status', (c) => c.json(driverStatus(ctx, userOf(c, 'driver'))));
  app.post('/driver/online', async (c) => {
    const driver = userOf(c, 'driver');
    const input = await body(c, goOnlineSchema);
    setOnline(ctx, driver, input.online, input.location ?? null);
    return c.json(driverStatus(ctx, driver));
  });
  app.post('/driver/location', async (c) => {
    const input = await body(c, locationUpdateSchema);
    return c.json(updateLocation(ctx, userOf(c, 'driver'), input.location));
  });
  app.post('/driver/offers/:id/accept', async (c) => {
    const driver = userOf(c, 'driver');
    const r = await idempotent(ctx, c, driver.id, { offer: c.req.param('id') }, () => acceptOffer(ctx, driver, c.req.param('id')), false);
    return c.json(withTracking(S(), r.ride, now()));
  });
  app.post('/driver/offers/:id/decline', async (c) => {
    const input = await body(c, declineOfferSchema);
    return c.json(declineOffer(ctx, userOf(c, 'driver'), c.req.param('id'), input.reasonCode));
  });
  const driverAction = (path: string, fn: (d: User, id: string) => unknown) =>
    app.post(`/driver/rides/:id/${path}`, (c) => {
      const d = userOf(c, 'driver');
      fn(d, c.req.param('id'));
      const ride = mustFind(S().rides, (r) => r.id === c.req.param('id'));
      return c.json(withTracking(S(), ride, now()));
    });
  driverAction('arrive', (d, id) => driverArrive(ctx, d, id));
  driverAction('start', (d, id) => driverStart(ctx, d, id));
  driverAction('stop-complete', (d, id) => driverCompleteStop(ctx, d, id));
  driverAction('complete', (d, id) => driverComplete(ctx, d, id));
  app.post('/driver/rides/:id/cash-collected', async (c) => {
    const input = await body(c, cashCollectedSchema);
    return c.json(confirmCashCollected(ctx, userOf(c, 'driver'), c.req.param('id'), input.amount));
  });
  app.post('/driver/rides/:id/cancel', async (c) => {
    const input = await body(c, cancelSchema);
    return c.json(driverCancel(ctx, userOf(c, 'driver'), c.req.param('id'), input.reasonCode, input.reasonText));
  });
  app.get('/driver/earnings', (c) => {
    const driver = userOf(c, 'driver');
    return c.json(earningsOf(S(), driver.id, c.req.query('from') ?? null, c.req.query('to') ?? null));
  });
  app.get('/driver/wallet', (c) => {
    const driver = userOf(c, 'driver');
    const s = S();
    return c.json({
      wallet: walletOf(s, driver.id, ctx.clock.iso()),
      pendingWithdrawals: s.withdrawals.filter((w) => w.driverId === driver.id && w.status === 'pending'),
      pendingRecharges: s.recharges.filter((r) => r.driverId === driver.id && r.status === 'pending'),
      payoutAccounts: s.payoutAccounts.filter((a) => a.driverId === driver.id),
      city: publicCity(s, driver.cityId),
    });
  });
  app.get('/driver/ledger', (c) => {
    const driver = userOf(c, 'driver');
    const type = c.req.query('type');
    const entries = S()
      .ledger.filter((e) => e.driverId === driver.id && (!type || e.type === type || (type === 'rides' && e.type.startsWith('ride'))))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return c.json(paginate(entries, c));
  });
  app.get('/driver/ledger/:id', (c) => {
    const driver = userOf(c, 'driver');
    const s = S();
    const entry = mustFind(s.ledger, (e) => e.id === c.req.param('id') && e.driverId === driver.id, 'mouvement');
    return c.json({
      entry,
      ride: entry.rideId ? s.rides.find((r) => r.id === entry.rideId) ?? null : null,
      recharge: entry.rechargeId ? s.recharges.find((r) => r.id === entry.rechargeId) ?? null : null,
      withdrawal: entry.withdrawalId ? s.withdrawals.find((w) => w.id === entry.withdrawalId) ?? null : null,
    });
  });
  app.get('/driver/transfers', (c) => {
    const driver = userOf(c, 'driver');
    const s = S();
    return c.json({
      recharges: s.recharges.filter((r) => r.driverId === driver.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      withdrawals: s.withdrawals.filter((w) => w.driverId === driver.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  });
  app.get('/payment-providers', (c) => {
    prototypeProviders(S());
    const user = userOf(c);
    const purpose = c.req.query('purpose') ?? 'recharge';
    return c.json(S().providers.filter((p) => p.cityId === user.cityId && p.purpose === purpose && p.enabled && p.configured));
  });
  app.post('/driver/recharges', async (c) => {
    const driver = userOf(c, 'driver');
    const input = await body(c, rechargeSchema);
    return c.json(await idempotent(ctx, c, driver.id, input, () => createRecharge(ctx, driver, input)));
  });
  app.get('/driver/recharges/:id', (c) => {
    const driver = userOf(c, 'driver');
    return c.json(mustFind(S().recharges, (r) => r.id === c.req.param('id') && r.driverId === driver.id, 'recharge'));
  });
  app.post('/driver/withdrawals', async (c) => {
    const driver = userOf(c, 'driver');
    const input = await body(c, withdrawalSchema);
    return c.json(await idempotent(ctx, c, driver.id, input, () => createWithdrawal(ctx, driver, input)));
  });
  app.get('/driver/withdrawals/:id', (c) => {
    const driver = userOf(c, 'driver');
    return c.json(mustFind(S().withdrawals, (w) => w.id === c.req.param('id') && w.driverId === driver.id, 'retrait'));
  });

  /* ───────── Provider sandbox and callbacks ───────── */
  /**
   * Stands in for the provider's hosted checkout (card authentication or agency counter).
   * It never receives card numbers from Naya screens; it resolves a pending reference.
   */
  app.post('/provider-sandbox/:kind/:ref/:outcome', (c) => {
    const p = c.get('principal');
    if (!p) throw new DomainError('UNAUTHORIZED');
    const kind = c.req.param('kind') as 'recharge' | 'payment';
    const outcome = c.req.param('outcome') === 'approve' ? 'confirmed' : 'failed';
    const s = S();
    const owned =
      p.kind === 'user' &&
      (kind === 'recharge'
        ? s.recharges.some((r) => r.providerRef === c.req.param('ref') && r.driverId === p.user.id)
        : s.payments.some((x) => x.providerRef === c.req.param('ref') && x.payerId === p.user.id));
    if (!owned && !ctx.config.devMode) throw new DomainError('FORBIDDEN');
    if (!owned && p.kind === 'user') throw new DomainError('FORBIDDEN');
    return c.json(resolveManually(ctx, kind, c.req.param('ref'), outcome, outcome === 'failed' ? 'Paiement refusé sur la page du prestataire.' : null));
  });
  app.post('/provider-sandbox/tokenize', async (c) => {
    // The provider's hosted field returns a token; Naya never sees the card number.
    userOf(c, 'passenger');
    const { last4 } = (await c.req.json()) as { last4: string };
    if (!/^\d{4}$/.test(last4)) throw new DomainError('VALIDATION');
    return c.json({ providerToken: `tok_demo_${last4}` });
  });
  app.post('/providers/:provider/callback', async (c) => {
    const raw = await c.req.text();
    if (!verifySignature(ctx.config.providerSecret, raw, c.req.header('X-Naya-Signature'))) throw new DomainError('PROVIDER_SIGNATURE_INVALID');
    const event = providerCallbackSchema.parse(JSON.parse(raw));
    return c.json(applyProviderEvent(ctx, event));
  });

  /* ───────── Support ───────── */
  app.get('/support/tickets', (c) => {
    const user = userOf(c);
    return c.json(S().tickets.filter((t) => t.userId === user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(publicTicket));
  });
  app.post('/support/tickets', async (c) => c.json(publicTicket(createTicket(ctx, userOf(c), await body(c, supportTicketSchema)))));
  app.get('/support/tickets/:id', (c) => {
    const user = userOf(c);
    return c.json(publicTicket(mustFind(S().tickets, (t) => t.id === c.req.param('id') && t.userId === user.id, 'demande')));
  });
  app.post('/support/tickets/:id/messages', async (c) => c.json(publicTicket(userMessage(ctx, userOf(c), c.req.param('id'), await body(c, supportMessageSchema)))));

  /* ───────── Admin ───────── */
  app.post('/admin/auth/login', async (c) => {
    const { email, password } = await body(c, adminLoginSchema);
    return c.json(adminLogin(ctx, email, password));
  });
  app.get('/admin/me', (c) => c.json(adminOf(c)));

  const period = (c: Context) => {
    const p = c.req.query('period') ?? '7d';
    const ms = p === 'today' ? 86_400_000 : p === '30d' ? 30 * 86_400_000 : p === 'all' ? Number.MAX_SAFE_INTEGER : 7 * 86_400_000;
    return (iso: string | null) => !!iso && now() - Date.parse(iso) <= ms;
  };

  app.get('/admin/overview', (c) => {
    adminOf(c);
    const s = S();
    const cityId = c.req.query('cityId') ?? 'rabat';
    const inPeriod = period(c);
    const rides = s.rides.filter((r) => r.cityId === cityId);
    const done = rides.filter((r) => r.status === 'completed' && inPeriod(r.completedAt));
    const volume = done.reduce((a, r) => a + r.terms.breakdown.total, 0);
    const commission = done.reduce((a, r) => a + Math.round((r.terms.breakdown.total * r.terms.commissionBp) / 10_000), 0);
    const byMethod = { wallet: done.filter(r=>r.paymentMethod.kind==='wallet').reduce((a,r)=>a+r.terms.breakdown.total,0), mobile_wallet: done.filter(r=>r.paymentMethod.kind==='mobile_wallet').reduce((a,r)=>a+r.terms.breakdown.total,0), cash: done.filter((r) => r.paymentMethod.kind === 'cash').reduce((a, r) => a + r.terms.breakdown.total, 0), card: done.filter((r) => r.paymentMethod.kind === 'card').reduce((a, r) => a + r.terms.breakdown.total, 0) };
    const queue = s.cases.filter((x) => (x.status === 'submitted' || x.status === 'in_review') && s.users.find((u) => u.id === x.userId)?.cityId === cityId);
    const online = s.presence.filter((p) => p.online && s.users.find((u) => u.id === p.driverId)?.cityId === cityId);
    return c.json({
      cityId,
      completedRides: done.length,
      volume,
      commission,
      byMethod,
      activeRides: rides.filter((r) => isRideActive(r.status)).length,
      reviewQueue: queue.map((x) => ({ caseId: x.id, subject: x.subject, userId: x.userId, userName: (() => { const u = s.users.find((y) => y.id === x.userId)!; return `${u.firstName} ${u.lastName}`; })(), submittedAt: x.submittedAt })),
      openTickets: s.tickets.filter((t) => t.cityId === cityId && t.status !== 'resolved').length,
      pendingTransfers: s.withdrawals.filter((w) => w.cityId === cityId && w.status === 'pending').length + s.recharges.filter((r) => r.cityId === cityId && r.status === 'pending').length,
      failedPayments: s.payments.filter((p) => p.status === 'failed' && rides.some((r) => r.id === p.rideId)).length,
      onlineDrivers: online.map((p) => ({ driverId: p.driverId, name: s.users.find((u) => u.id === p.driverId)!.firstName, location: p.location, bot: p.bot })),
      recentRides: rides.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).slice(0, 6),
    });
  });

  app.get('/admin/people', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'people.read');
    const s = S();
    const q = normalize(c.req.query('q') ?? '');
    const role = c.req.query('role');
    const cityId = c.req.query('cityId');
    const status = c.req.query('verification');
    const people = s.users
      .filter((u) => (!role || u.role === role) && (!cityId || u.cityId === cityId))
      .map((u) => {
        const identity = s.cases.find((x) => x.id === u.identityCaseId);
        const vehicleCase = s.cases.find((x) => x.userId === u.id && x.subject === 'vehicle');
        return { user: u, identityStatus: identity?.status ?? 'draft', vehicleStatus: vehicleCase?.status ?? null, vehicle: s.vehicles.find((v) => v.id === u.vehicleId) ?? null, wallet: u.role === 'driver' ? walletOf(s, u.id, ctx.clock.iso()) : null };
      })
      .filter((p) => !q || normalize(`${p.user.firstName} ${p.user.lastName} ${p.user.phone} ${p.user.id} ${p.vehicle?.plate ?? ''}`).includes(q))
      .filter((p) => !status || p.identityStatus === status || p.vehicleStatus === status)
      .sort((a, b) => a.user.id.localeCompare(b.user.id));
    return c.json(paginate(people, c));
  });
  app.get('/admin/people/:id', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'people.read');
    const s = S();
    const user = mustFind(s.users, (u) => u.id === c.req.param('id'), 'personne');
    const canFinance = admin.permissions.includes('finance.read');
    return c.json({
      user,
      cases: casesForUser(s, user),
      vehicle: s.vehicles.find((v) => v.id === user.vehicleId) ?? null,
      rides: s.rides.filter((r) => r.passengerId === user.id || r.driverId === user.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).slice(0, 20),
      wallet: user.role === 'driver' && canFinance ? walletOf(s, user.id, ctx.clock.iso()) : null,
      ledger: user.role === 'driver' && canFinance ? s.ledger.filter((e) => e.driverId === user.id).slice(-20).reverse() : [],
      tickets: s.tickets.filter((t) => t.userId === user.id),
      presence: s.presence.find((p) => p.driverId === user.id) ?? null,
      eligibility: user.role === 'driver' ? driverEligibility(s, user, ctx.clock.iso()) : null,
      audit: s.audit.filter((e) => e.entityId === user.id || casesForUser(s, user).some((x) => x.id === e.entityId)).slice(-30).reverse(),
    });
  });

  app.get('/admin/verifications', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'people.read');
    const s = S();
    const status = c.req.query('status');
    const subject = c.req.query('subject');
    const cityId = c.req.query('cityId');
    const rows = s.cases
      .filter((x) => x.status !== 'draft')
      .filter((x) => (!status || (status === 'queue' ? x.status === 'submitted' || x.status === 'in_review' : x.status === status)) && (!subject || x.subject === subject))
      .map((x) => ({ case: x, user: s.users.find((u) => u.id === x.userId)! }))
      .filter((r) => !cityId || r.user.cityId === cityId)
      .sort((a, b) => (a.case.submittedAt ?? '').localeCompare(b.case.submittedAt ?? ''));
    return c.json(paginate(rows, c));
  });
  app.get('/admin/verifications/:id', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'people.read');
    const s = S();
    const cs = mustFind(s.cases, (x) => x.id === c.req.param('id'), 'dossier');
    const user = s.users.find((u) => u.id === cs.userId)!;
    return c.json({
      case: cs,
      user,
      related: s.cases.filter((x) => x.userId === cs.userId && x.id !== cs.id),
      vehicle: cs.vehicleId ? s.vehicles.find((v) => v.id === cs.vehicleId) ?? null : null,
      audit: s.audit.filter((e) => e.entityId === cs.id).reverse(),
      rejectionReasons: REJECTION_REASONS,
      canDecide: admin.permissions.includes('verification.decide'),
    });
  });
  app.post('/admin/verifications/:id/start-review', (c) => c.json(startReview(ctx, adminOf(c), c.req.param('id'))));
  app.post('/admin/verifications/:id/decision', async (c) => c.json(decideCase(ctx, adminOf(c), c.req.param('id'), await body(c, decisionSchema))));

  app.get('/admin/rides', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'rides.read');
    const s = S();
    const q = normalize(c.req.query('q') ?? '');
    const status = c.req.query('status');
    const cityId = c.req.query('cityId');
    const method = c.req.query('method');
    const rides = s.rides
      .filter((r) => (!cityId || r.cityId === cityId) && (!status || (status === 'active' ? isRideActive(r.status) : r.status === status)) && (!method || r.paymentMethod.kind === method))
      .filter((r) => !q || normalize(`${r.id} ${r.passenger.firstName} ${r.driver?.firstName ?? ''} ${r.route.stops.map((x) => x.label).join(' ')}`).includes(q))
      .map((r) => ({ ride: r, payment: s.payments.find((p) => p.id === r.paymentId) ?? null, passengerName: (() => { const u = s.users.find((x) => x.id === r.passengerId)!; return `${u.firstName} ${u.lastName}`; })(), driverName: r.driverId ? (() => { const u = s.users.find((x) => x.id === r.driverId)!; return `${u.firstName} ${u.lastName}`; })() : null }))
      .sort((a, b) => {
        const k = c.req.query('sort') ?? 'recent';
        if (k === 'amount') return b.ride.terms.breakdown.total - a.ride.terms.breakdown.total;
        return b.ride.requestedAt.localeCompare(a.ride.requestedAt);
      });
    return c.json(paginate(rides, c));
  });
  app.get('/admin/scheduled', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'rides.read');
    const s = S();
    const cityId = c.req.query('cityId');
    return c.json(s.scheduled.filter((b) => !cityId || b.cityId === cityId).map((b) => ({ booking: b, passengerName: (() => { const u = s.users.find((x) => x.id === b.passengerId)!; return `${u.firstName} ${u.lastName}`; })() })).sort((a, b) => a.booking.pickupAt.localeCompare(b.booking.pickupAt)));
  });
  app.get('/admin/rides/:id', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'rides.read');
    const s = S();
    const ride = mustFind(s.rides, (r) => r.id === c.req.param('id'), 'course');
    const canFinance = admin.permissions.includes('finance.read');
    return c.json({
      ride: withTracking(s, ride, now()),
      offers: s.offers.filter((o) => o.rideId === ride.id).map((o) => ({ ...o, driverName: (() => { const u = s.users.find((x) => x.id === o.driverId); return u ? `${u.firstName} ${u.lastName}` : o.driverId; })() })),
      payments: s.payments.filter((p) => p.rideId === ride.id),
      ledger: canFinance ? s.ledger.filter((e) => e.rideId === ride.id) : [],
      tickets: s.tickets.filter((t) => t.rideId === ride.id),
      audit: s.audit.filter((e) => e.entityId === ride.id || s.payments.some((p) => p.rideId === ride.id && p.id === e.entityId)),
      passenger: s.users.find((u) => u.id === ride.passengerId),
      driver: ride.driverId ? s.users.find((u) => u.id === ride.driverId) : null,
    });
  });

  app.get('/admin/support', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'support.resolve');
    const status = c.req.query('status');
    const cityId = c.req.query('cityId');
    const disputes = c.req.query('disputes') === '1';
    return c.json(
      paginate(
        S().tickets.filter((t) => (!status || (status === 'open' ? t.status !== 'resolved' && t.status !== 'rejected' : status === 'new' ? t.status === 'open' : t.status === status)) && (!cityId || t.cityId === cityId) && (!disputes || t.isDispute)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        c,
      ),
    );
  });
  app.get('/admin/support/:id', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'support.resolve');
    const s = S();
    const t = mustFind(s.tickets, (x) => x.id === c.req.param('id'), 'demande');
    const reason = t.reasonId ? ensurePrototype(s).catalog.reasons.find((r) => r.id === t.reasonId) ?? null : null;
    const ride = t.rideId ? s.rides.find((r) => r.id === t.rideId) ?? null : null;
    const person = (id: string | null | undefined) => {
      const u = s.users.find((x) => x.id === id);
      return u ? { id: u.id, name: `${u.firstName} ${u.lastName}`, phone: u.phone } : null;
    };
    return c.json({ ticket: t, reason, passenger: person(ride?.passengerId ?? (t.userRole === 'passenger' ? t.userId : null)), driver: person(ride?.driverId ?? (t.userRole === 'driver' ? t.userId : null)), ride, payments: t.rideId ? s.payments.filter((p) => p.rideId === t.rideId) : [], audit: s.audit.filter((e) => e.entityId === t.id) });
  });
  app.post('/admin/support/:id/messages', async (c) => c.json(agentMessage(ctx, adminOf(c), c.req.param('id'), await body(c, agentMessageSchema))));
  app.post('/admin/support/:id/status', async (c) => c.json(setTicketStatus(ctx, adminOf(c), c.req.param('id'), await body(c, ticketStatusSchema))));
  app.post('/admin/support/:id/actions', async (c) => c.json(recordTicketAction(ctx, adminOf(c), c.req.param('id'), await body(c, ticketActionSchema))));
  app.post('/admin/support/:id/resolve', async (c) => c.json(resolveTicket(ctx, adminOf(c), c.req.param('id'), await body(c, resolveTicketSchema))));

  app.get('/admin/finance/summary', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'finance.read');
    const s = S();
    const cityId = c.req.query('cityId') ?? 'rabat';
    const at = ctx.clock.iso();
    const drivers = s.users.filter((u) => u.role === 'driver' && u.cityId === cityId).map((u) => ({ driver: u, wallet: walletOf(s, u.id, at) }));
    return c.json({
      cityId,
      drivers,
      totals: {
        balances: drivers.reduce((a, d) => a + d.wallet.balance, 0),
        reserved: drivers.reduce((a, d) => a + d.wallet.reserved, 0),
        debt: drivers.reduce((a, d) => a + d.wallet.debt, 0),
        blocked: drivers.filter((d) => d.wallet.offersBlockedByDebt).length,
      },
      recharges: s.recharges.filter((r) => r.cityId === cityId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      withdrawals: s.withdrawals.filter((w) => w.cityId === cityId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      failedPayments: s.payments.filter((p) => p.status === 'failed' && s.rides.find((r) => r.id === p.rideId)?.cityId === cityId),
      pendingPayments: s.payments.filter((p) => p.status === 'pending' && s.rides.find((r) => r.id === p.rideId)?.cityId === cityId),
    });
  });
  app.get('/admin/finance/ledger', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'finance.read');
    const s = S();
    const driverId = c.req.query('driverId');
    const type = c.req.query('type');
    const cityId = c.req.query('cityId');
    const entries = s.ledger
      .filter((e) => (!driverId || e.driverId === driverId) && (!type || e.type === type) && (!cityId || s.users.find((u) => u.id === e.driverId)?.cityId === cityId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .map((e) => ({ entry: e, driverName: (() => { const u = s.users.find((x) => x.id === e.driverId)!; return `${u.firstName} ${u.lastName}`; })() }));
    return c.json(paginate(entries, c));
  });
  app.post('/admin/finance/corrections', async (c) => {
    const admin = adminOf(c);
    const input = await body(c, correctionSchema);
    const key = c.req.header('Idempotency-Key');
    if (!key) throw new DomainError('VALIDATION', 'En-tête Idempotency-Key requis.');
    return c.json(createCorrection(ctx, admin, input, key));
  });

  app.get('/admin/cities', (c) => {
    adminOf(c);
    const s = S();
    return c.json(s.cities.map((city) => ({ city, zones: s.zones.filter((z) => z.cityId === city.id), versions: s.cityRuleVersions.filter((v) => v.cityId === city.id).sort((a, b) => b.version - a.version), providers: s.providers.filter((p) => p.cityId === city.id) })));
  });
  app.post('/admin/cities', async (c) => c.json(createCity(ctx, adminOf(c), await body(c, createCitySchema))));
  app.put('/admin/cities/:id/rules', async (c) => c.json(updateRules(ctx, adminOf(c), c.req.param('id'), await body(c, updateRulesSchema))));
  app.post('/admin/cities/:id/status', async (c) => c.json(setCityStatus(ctx, adminOf(c), c.req.param('id'), await body(c, cityStatusSchema))));
  app.post('/admin/cities/:id/zones', async (c) => c.json(addZone(ctx, adminOf(c), c.req.param('id'), await body(c, zoneSchema))));
  app.post('/admin/zones/:id/active', async (c) => {
    const { active, reason } = (await c.req.json()) as { active: boolean; reason: string };
    return c.json(setZoneActive(ctx, adminOf(c), c.req.param('id'), !!active, reasonSchema.parse(reason)));
  });
  app.get('/admin/providers', (c) => {
    adminOf(c);
    const cityId = c.req.query('cityId');
    return c.json(S().providers.filter((p) => !cityId || p.cityId === cityId));
  });
  app.post('/admin/providers/:id', async (c) => c.json(toggleProvider(ctx, adminOf(c), c.req.param('id'), await body(c, providerToggleSchema))));

  app.get('/admin/audit', (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'audit.read');
    const s = S();
    const q = normalize(c.req.query('q') ?? '');
    const action = c.req.query('action');
    const cityId = c.req.query('cityId');
    const actorType = c.req.query('actorType');
    const events = [...s.audit]
      .reverse()
      .filter((e) => (!action || e.action.startsWith(action)) && (!cityId || e.cityId === cityId || e.cityId === null) && (!actorType || e.actor.type === actorType))
      .filter((e) => !q || normalize(`${e.summary} ${e.entityId} ${e.actor.name} ${e.reason ?? ''}`).includes(q));
    return c.json({ ...paginate(events, c), integrity: verifyAuditChain(s.audit) });
  });

  /* ───────── Development tools (scenario launcher) ───────── */
  if (ctx.config.devMode) {
    app.get('/dev/scenarios', (c) => c.json({ scenarios: SCENARIOS, accounts: DEMO_ACCOUNTS, current: S().scenario }));
    app.post('/dev/reset', async (c) => {
      const { scenario = 'default' } = (await c.req.json().catch(() => ({}))) as { scenario?: ScenarioId };
      if (!(scenario in SCENARIOS)) throw new DomainError('VALIDATION', 'Scénario inconnu.');
      ctx.clock.reset();
      const next = buildSeed(ctx.config.dataDir, scenario, ctx.clock.now());
      next.version = S().version + 1;
      ctx.store.replace(next);
      return c.json({ ok: true, scenario });
    });
    app.post('/dev/clock/advance', async (c) => {
      const { seconds } = (await c.req.json()) as { seconds: number };
      ctx.clock.advance(Number(seconds));
      tick(ctx);
      return c.json({ time: ctx.clock.iso() });
    });
    app.post('/dev/tick', (c) => {
      tick(ctx);
      return c.json({ time: ctx.clock.iso(), version: S().version });
    });
    app.post('/dev/providers/:kind/:ref/:outcome', (c) => {
      const outcome = c.req.param('outcome') === 'confirm' ? 'confirmed' : 'failed';
      return c.json(resolveManually(ctx, c.req.param('kind') as 'payment', c.req.param('ref'), outcome, outcome === 'failed' ? 'Échec simulé depuis le lanceur de scénarios.' : null));
    });
    app.post('/dev/bot', async (c) => {
      const { online } = (await c.req.json()) as { online: boolean };
      return c.json(
        ctx.store.tx((s) => {
          const p = mustFind(s.presence, (x) => x.bot, 'chauffeuse simulée');
          p.online = !!online;
          p.updatedAt = ctx.clock.iso();
          const driver = s.users.find((u) => u.id === p.driverId)!;
          appendAudit(s, ctx.clock.iso(), { actor: { type: 'system', id: 'dev', name: 'Lanceur de scénarios' }, action: online ? 'dev.bot_online' : 'dev.bot_offline', entityType: 'user', entityId: driver.id, summary: `Chauffeuse simulée ${driver.firstName} ${online ? 'en ligne' : 'hors ligne'}` });
          if (online) dispatchCity(s, driver.cityId, ctx.clock.now());
          return p;
        }),
      );
    });
    app.post('/dev/tracking/:rideId/freeze', (c) =>
      c.json(
        ctx.store.tx((s) => {
          s.tracking = s.tracking.filter((t) => t.rideId !== c.req.param('rideId'));
          s.tracking.push({ rideId: c.req.param('rideId'), frozenAt: ctx.clock.iso() });
          return { ok: true };
        }),
      ),
    );
    app.post('/dev/tracking/:rideId/resume', (c) =>
      c.json(
        ctx.store.tx((s) => {
          s.tracking = s.tracking.filter((t) => t.rideId !== c.req.param('rideId'));
          return { ok: true };
        }),
      ),
    );
    app.get('/dev/provider-jobs', (c) => c.json(S().providerJobs.filter((j) => !j.delivered)));
    /**
     * Review-capture hook: a development build polls this to navigate itself (and optionally
     * sign in as a demo account), so native screenshots can be taken without tapping.
     */
    const navQueue = new Map<string, { id: number; route: string; phone: string | null }>();
    let navSeq = 0;
    app.post('/dev/navigate', async (c) => {
      const { app: target, route, phone = null } = (await c.req.json()) as { app: 'passenger' | 'driver'; route: string; phone?: string | null };
      const cmd = { id: ++navSeq, route, phone };
      navQueue.set(target, cmd);
      return c.json(cmd);
    });
    app.get('/dev/navigate', (c) => c.json(navQueue.get(c.req.query('app') ?? '') ?? null));

    /**
     * Capture bypass for simulators and demos without a camera: stores one of the fictional
     * "SPÉCIMEN" fixtures as the caller's own upload, exactly as a real photo would be.
     */
    const SAMPLES: Record<string, string> = {
      selfie: 'amina-selfie.jpg',
      id_front: 'generic-id-front.jpg',
      id_back: 'generic-id-back.jpg',
      driving_licence: 'amina-licence.jpg',
      vehicle_registration: 'vehicle-registration-2.jpg',
      insurance: 'insurance.jpg',
      vehicle_photos: 'vehicle-pearl.jpg',
    };
    app.post('/dev/sample-upload', async (c) => {
      const p = c.get('principal');
      if (!p || p.kind !== 'user') throw new DomainError('UNAUTHORIZED');
      const { purpose } = (await c.req.json()) as { purpose: string };
      const file = SAMPLES[purpose];
      if (!file) throw new DomainError('VALIDATION', 'Aucun exemple pour cette pièce.');
      const data = readFileSync(fixturePath(file));
      return c.json(createUpload(ctx, p.user.id, { purpose: purpose as UploadInput['purpose'], mimeType: 'image/jpeg', dataBase64: data.toString('base64'), width: null, height: null }));
    });
  }

  return app;
}
