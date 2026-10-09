import { z } from 'zod';
import type { Hono, Context } from 'hono';
import {
  defaultDisputeReasons,
  defaultPrototypeCatalog,
  demoRoute,
  DomainError,
  FAMILY_NEXT,
  FAMILY_STATUS_LABELS,
  PLACES,
  pointAlong,
  SAFETY_ACTION_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type DedicatedDriverSummary,
  type FamilyChild,
  type FamilyIncident,
  type FamilyTripKind,
  type User,
  type AdminUser,
  type PrototypeState,
  type PassengerWallet,
  type FamilyTrip,
  type Place,
  type PrototypeCatalog,
} from '@naya/domain';
import type { Principal } from './auth';
import type { State } from '../state';
import type { Ctx } from '../context';
import { mustFind, nextId } from '../store';
import { appendAudit } from '../audit';
import { requirePermission } from './permissions';
import { createTicket } from './support';

type Env = { Variables: { principal: Principal | null } };
const text = z.string().trim().min(1).max(300);
const cents = z.number().int().min(0).max(10_000_000);
const location = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const place = z.object({
  id: z.string().nullable(),
  label: text,
  address: text,
  location,
});
const categorySchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,40}$/, 'Identifiant : minuscules, chiffres et tirets'),
  name: text,
  description: text,
  icon: z.enum(['car', 'scooter', 'premium']),
  enabled: z.boolean(),
  cityIds: z.array(text),
  etaMinutes: z.number().int().min(1).max(60),
  commissionBp: z.number().int().min(0).max(5000),
  baseFare: cents.nullable(),
  perKm: cents.nullable(),
  perMinute: cents.nullable(),
  minimumFare: cents.nullable(),
  conditions: z.array(text).max(8).default([]),
});
const planSchema = z.object({
  id: text,
  name: text,
  price: cents,
  durationDays: z.number().int().min(1).max(365),
  includedTrips: z.number().int().min(1).max(500),
  enabled: z.boolean(),
  features: z.array(text).min(1),
  dedicatedDriver: z.boolean().default(true),
});
const reasonSchema = z.object({
  id: text,
  label: text,
  category: z.enum(['ride', 'payment', 'safety', 'account', 'wallet', 'other']),
  evidenceRequired: z.boolean(),
  enabled: z.boolean(),
  roles: z.array(z.enum(['passenger', 'driver'])).max(2).default([]),
});
const paymentSchema = z.object({
  id: text,
  name: text,
  kind: z.enum(['card', 'mobile', 'agency']),
  enabled: z.boolean(),
  cityIds: z.array(text),
});
const childSchema = z.object({
  firstName: text,
  age: z.number().int().min(1).max(17),
  photo: z.string().max(40).nullable().optional(),
  school: text,
  schoolPlace: place.nullable().optional(),
  notes: z.string().trim().max(500),
  recipients: z
    .array(
      z.object({
        id: text,
        name: text,
        relationship: text,
        phone: z.string().trim().max(30).optional(),
        verificationCode: z
          .string()
          .regex(/^\d{4}$/, 'Code à 4 chiffres requis'),
      }),
    )
    .min(1)
    .max(8),
});
const closed = (status: string) => status === 'completed';

export function ensurePrototype(s: State): PrototypeState {
  const p = (s.prototype ??= {
    catalog: defaultPrototypeCatalog(),
    children: [],
    subscriptions: [],
    trips: [],
    alerts: [],
    wallets: [],
    driverCategories: {},
  });
  // Stores written before categories had conditions.
  for (const c of p.catalog.categories) c.conditions ??= [];
  // Stores written before the detailed dispute reasons: add the new ones, keep admin edits.
  for (const r of defaultDisputeReasons())
    if (!p.catalog.reasons.some((x) => x.id === r.id)) p.catalog.reasons.push(r);
  for (const plan of p.catalog.plans) plan.dedicatedDriver ??= true;
  p.familyAvailability ??= {};
  return p;
}
export function passengerWallet(s: State, userId: string): PassengerWallet {
  const p = ensurePrototype(s);
  let w = p.wallets.find((x) => x.userId === userId);
  if (!w)
    p.wallets.push((w = { userId, balance: 0, reserved: 0, entries: [] }));
  w.balance = w.entries
    .filter((e) => e.status === 'confirmed')
    .reduce((n, e) => n + e.amount, 0);
  w.reserved = -w.entries
    .filter((e) => e.status === 'pending' && e.amount < 0)
    .reduce((n, e) => n + e.amount, 0);
  return w;
}
export function reservePassengerWallet(
  s: State,
  userId: string,
  reference: string,
  amount: number,
  at: string,
) {
  const w = passengerWallet(s, userId);
  if (
    w.entries.some((e) => e.id === `hold:${reference}` && e.status !== 'failed')
  )
    return;
  if (w.balance - w.reserved < amount)
    throw new DomainError(
      'VALIDATION',
      'Solde du portefeuille insuffisant. Rechargez ou choisissez un autre moyen.',
    );
  w.entries.push({
    id: `hold:${reference}`,
    amount: -amount,
    label: `Montant réservé · ${reference}`,
    status: 'pending',
    at,
    rideId: reference,
    providerId: null,
  });
  passengerWallet(s, userId);
}
export function releasePassengerWallet(
  s: State,
  userId: string,
  reference: string,
) {
  const w = passengerWallet(s, userId);
  for (const e of w.entries.filter(
    (e) => e.rideId === reference && e.status === 'pending' && e.amount < 0,
  ))
    e.status = 'failed';
  passengerWallet(s, userId);
}
export function settlePassengerWallet(
  s: State,
  userId: string,
  reference: string,
  amount: number,
  at: string,
) {
  const w = passengerWallet(s, userId);
  const prior = w.entries.find(
    (e) => e.rideId === reference && e.status === 'confirmed' && e.amount < 0,
  );
  if (prior) return;
  const hold = w.entries.find(
    (e) => e.rideId === reference && e.status === 'pending' && e.amount < 0,
  );
  if (hold) {
    hold.status = 'confirmed';
    hold.amount = -amount;
    hold.label = `Course · ${reference}`;
    hold.at = at;
  } else {
    reservePassengerWallet(s, userId, reference, amount, at);
    return settlePassengerWallet(s, userId, reference, amount, at);
  }
  passengerWallet(s, userId);
}
export function prototypeMethods(s: State, user: User) {
  const p = ensurePrototype(s);
  passengerWallet(s, user.id);
  const methods = [
    {
      id: `wallet-${user.id}`,
      kind: 'wallet' as const,
      label: 'Portefeuille Naya',
    },
    {
      id: `mobile-${user.id}`,
      kind: 'mobile_wallet' as const,
      label: 'Wallet marocain (démo)',
    },
  ];
  for (const m of methods)
    if (!s.paymentMethods.some((x) => x.id === m.id))
      s.paymentMethods.push({
        ...m,
        userId: user.id,
        providerToken: null,
        last4: null,
        expMonth: null,
        expYear: null,
        isDefault: false,
      });
  return p;
}
export function prototypeProviders(s: State, force = false) {
  const p = ensurePrototype(s);
  for (const city of s.cities)
    for (const option of p.catalog.payments) {
      const id = `${city.id}-${option.id}-recharge`;
      let existing = s.providers.find((x) => x.id === id);
      const created = !existing;
      if (!existing)
        s.providers.push(
          (existing = {
            id,
            cityId: city.id,
            purpose: 'recharge',
            kind: option.kind === 'card' ? 'card' : 'cash_network',
            name: `${option.name} (démo)`,
            enabled: false,
            mode: 'demo',
            configured: true,
          }),
        );
      existing.name = `${option.name} (démo)`;
      if (force || created)
        existing.enabled =
          option.enabled &&
          (!option.cityIds.length || option.cityIds.includes(city.id));
    }
}
export function categoryFor(s: State, cityId: string, id = 'standard') {
  return mustFind(
    ensurePrototype(s).catalog.categories,
    (c) =>
      c.id === id &&
      c.enabled &&
      (!c.cityIds.length || c.cityIds.includes(cityId)),
    'catégorie disponible',
  );
}
function family(s: State, user: User) {
  const p = ensurePrototype(s);
  return {
    children: p.children
      .filter((x) =>
        user.role === 'driver'
          ? p.trips.some((t) => t.driverId === user.id && t.childId === x.id)
          : x.passengerId === user.id,
      )
      // The driver checks the code with the server; she never receives it.
      .map((x) =>
        user.role === 'driver'
          ? {
              ...x,
              recipients: x.recipients.map((r) => ({
                ...r,
                verificationCode: '',
              })),
            }
          : x,
      ),
    subscription:
      p.subscriptions.find((x) => x.passengerId === user.id) ?? null,
    trips: p.trips
      .filter((x) =>
        user.role === 'driver'
          ? x.driverId === user.id
          : x.passengerId === user.id,
      )
      .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt)),
  };
}
function log(
  ctx: Ctx,
  s: State,
  actor: User | AdminUser,
  action: string,
  entityId: string,
  label: string,
) {
  appendAudit(s, ctx.clock.iso(), {
    actor: {
      type: 'role' in actor ? 'user' : 'admin',
      id: actor.id,
      name: 'firstName' in actor ? actor.firstName : actor.name,
    },
    action,
    entityType: 'prototype',
    entityId,
    cityId: 'cityId' in actor ? actor.cityId : null,
    summary: label,
  });
}
function verifiedDriver(s: State, x: User) {
  return (
    s.cases.some((c) => c.id === x.identityCaseId && c.status === 'approved') &&
    s.cases.some((c) => c.userId === x.id && c.subject === 'vehicle' && c.status === 'approved')
  );
}
function dedicatedDrivers(s: State): DedicatedDriverSummary[] {
  const p = ensurePrototype(s);
  return s.users
    .filter((u) => u.role === 'driver')
    .map((u) => {
      const trips = p.trips.filter((t) => t.driverId === u.id);
      const v = s.vehicles.find((x) => x.id === u.vehicleId);
      const done = trips.filter((t) => t.status === 'completed');
      return {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        cityId: u.cityId,
        phone: u.phone,
        online: !!s.presence.find((x) => x.driverId === u.id)?.online,
        available: p.familyAvailability?.[u.id] !== false,
        verified: u.status === 'active' && verifiedDriver(s, u),
        rating: u.ratingAverage,
        vehicle: v ? `${v.make} ${v.model} · ${v.color} · ${v.plate}` : null,
        families: p.subscriptions
          .filter((x) => x.driverId === u.id)
          .map((x) => {
            const owner = s.users.find((o) => o.id === x.passengerId);
            return { subscriptionId: x.id, passengerId: x.passengerId, passengerName: owner ? `${owner.firstName} ${owner.lastName}` : x.passengerId, status: x.status };
          }),
        trips: {
          total: trips.length,
          completed: done.length,
          upcoming: trips.filter((t) => t.status === 'scheduled').length,
          lastAt: done.map((t) => t.times?.completed ?? t.pickupAt).sort().at(-1) ?? null,
        },
        incidents: trips.reduce((n, t) => n + (t.incidents?.length ?? (t.incident ? 1 : 0)), 0),
        sos: p.alerts.filter((a) => a.driverId === u.id || a.userId === u.id).length,
      };
    });
}
function addSubscription(ctx: Ctx, s: State, user: User, planId: string) {
  const p = ensurePrototype(s);
  if (
    !s.cases.some(
      (c) => c.id === user.identityCaseId && c.status === 'approved',
    )
  )
    throw new DomainError('VERIFICATION_REQUIRED');
  const plan = mustFind(
    p.catalog.plans,
    (x) => x.id === planId && x.enabled,
    'abonnement',
  );
  const load = (id: string) =>
    p.subscriptions.filter((x) => x.driverId === id && x.status !== 'cancelled').length;
  const driver = s.users
    .filter(
      (x) =>
        x.role === 'driver' &&
        x.cityId === user.cityId &&
        x.status === 'active' &&
        verifiedDriver(s, x) &&
        p.familyAvailability?.[x.id] !== false,
    )
    .sort((a, b) => load(a.id) - load(b.id))[0];
  if (!driver)
    throw new DomainError('NOT_FOUND', 'Aucune chauffeuse vérifiée disponible pour les familles dans votre ville.');
  const current = p.subscriptions.find((x) => x.passengerId === user.id);
  if (
    current &&
    current.status !== 'cancelled' &&
    Date.parse(current.endsAt) > ctx.clock.now()
  )
    throw new DomainError('CONFLICT', current.status === 'paused' ? 'Votre abonnement est suspendu. Contactez le support Naya.' : 'Vous avez déjà un abonnement actif.');
  const subscription = {
    id: nextId(s, 'SUB'),
    passengerId: user.id,
    planId,
    planName: plan.name,
    price: plan.price,
    includedTrips: plan.includedTrips,
    driverId: driver.id,
    driverName: `${driver.firstName} ${driver.lastName}`,
    status: 'active' as const,
    statusHistory: [{ at: ctx.clock.iso(), by: `${user.firstName} ${user.lastName}`, status: 'active' as const, reason: 'Souscription · paiement simulé' }],
    startsAt: ctx.clock.iso(),
    endsAt: new Date(
      ctx.clock.now() + plan.durationDays * 86400000,
    ).toISOString(),
  };
  if (current) Object.assign(current, subscription);
  else p.subscriptions.push(subscription);
  log(
    ctx,
    s,
    user,
    'family.subscribed',
    subscription.id,
    'Abonnement famille activé · paiement simulé',
  );
  return subscription;
}
function addTrip(
  ctx: Ctx,
  s: State,
  user: User,
  input: {
    childId: string;
    pickup: Place;
    destination: Place;
    pickupAt: string;
    weekdays: number[];
    kind?: FamilyTripKind;
  },
) {
  const p = ensurePrototype(s);
  const sub = mustFind(
    p.subscriptions,
    (x) =>
      x.passengerId === user.id &&
      x.status === 'active' &&
      Date.parse(x.endsAt) > ctx.clock.now(),
    'abonnement actif',
  );
  if (input.pickupAt >= sub.endsAt || input.pickupAt < sub.startsAt)
    throw new DomainError(
      'VALIDATION',
      'Le trajet doit être compris dans la période de l’abonnement.',
    );
  const child = mustFind(
    p.children,
    (x) => x.id === input.childId && x.passengerId === user.id,
    'enfant',
  );
  if (
    p.trips.filter(
      (t) =>
        t.passengerId === user.id &&
        t.pickupAt >= sub.startsAt &&
        t.pickupAt < sub.endsAt,
    ).length >= sub.includedTrips
  )
    throw new DomainError(
      'VALIDATION',
      'Le nombre de trajets inclus est atteint.',
    );
  const road = demoRoute([input.pickup, input.destination]);
  const trip: FamilyTrip = {
    ...input,
    kind: input.kind ?? 'other',
    route: road.polyline,
    durationSeconds: road.durationSeconds,
    vehicle: null,
    times: { scheduled: ctx.clock.iso() },
    stoppedAt: null,
    alertsSent: [],
    incidents: [],
    id: nextId(s, 'FT'),
    passengerId: user.id,
    childName: child.firstName,
    driverId: sub.driverId,
    driverName: sub.driverName,
    status: 'scheduled',
    location: input.pickup.location,
    recipientId: null,
    arrivalProof: null,
    pickupVerified: false,
    timeline: [],
    notifications: [],
    incident: null,
  };
  trip.timeline.push({
    at: ctx.clock.iso(),
    label: 'Trajet familial planifié',
    location: trip.location,
  });
  p.trips.push(trip);
  log(
    ctx,
    s,
    user,
    'family.trip_created',
    trip.id,
    `Trajet de ${child.firstName} planifié`,
  );
  return trip;
}

function checkChildPhoto(s: State, user: User, photo?: string | null) {
  if (!photo) return;
  const upload = mustFind(
    s.uploads,
    (x) => x.id === photo && x.ownerId === user.id,
    'photo',
  );
  if (!upload.mimeType.startsWith('image/'))
    throw new DomainError('VALIDATION', 'La photo doit être une image.');
}
function reportIncident(ctx: Ctx, t: FamilyTrip, incident: FamilyIncident) {
  (t.incidents ??= []).push(incident);
  t.incident = incident.message;
  t.notifications.push({ at: incident.at, title: incident.message });
  t.timeline.push({
    at: incident.at,
    label: incident.message,
    location: incident.location,
  });
}

/** Demo trips play 20× faster than real time, like classic rides. */
const FAMILY_TIME_FACTOR = 20;
/** Alert the parent when the driver is not at the pickup point 5 minutes after the planned time. */
const LATE_PICKUP_MS = 5 * 60_000;
/** A vehicle stopped for 3 minutes (real time) during a child trip is unusual. */
const UNUSUAL_STOP_MS = (3 * 60_000) / FAMILY_TIME_FACTOR;

/**
 * Live tracking and automatic alerts for child trips: moves the vehicle along
 * the route and warns the parent of delays and unusual stops. Called by `tick`.
 */
export function runFamilyTimers(ctx: Ctx) {
  const trips = ctx.store.state.prototype?.trips;
  const due = (t: FamilyTrip) =>
    t.status === 'in_progress' ||
    ((t.status === 'scheduled' || t.status === 'en_route') &&
      ctx.clock.now() > Date.parse(t.pickupAt) + LATE_PICKUP_MS &&
      !t.alertsSent?.includes('late_pickup'));
  if (!trips?.some(due)) return;
  ctx.store.tx((s) => {
    const now = ctx.clock.now();
    const at = new Date(now).toISOString();
    for (const t of ensurePrototype(s).trips) {
      if (t.status === 'completed') continue;
      const sent = (t.alertsSent ??= []);
      const alert = (key: string, message: string) => {
        if (sent.includes(key)) return;
        sent.push(key);
        reportIncident(ctx, t, {
          at,
          by: 'Naya',
          message,
          location: t.location,
          source: 'auto',
        });
        appendAudit(s, at, {
          actor: { type: 'system', id: 'family-monitor', name: 'Naya' },
          action: 'family.alert',
          entityType: 'prototype',
          entityId: t.id,
          cityId: null,
          summary: message,
        });
      };
      if (
        (t.status === 'scheduled' || t.status === 'en_route') &&
        now > Date.parse(t.pickupAt) + LATE_PICKUP_MS
      )
        alert(
          'late_pickup',
          `Retard : la chauffeuse n’est pas encore arrivée pour ${t.childName}`,
        );
      if (t.status !== 'in_progress' || !t.route?.length) continue;
      const started = Date.parse(t.times?.in_progress ?? at);
      const expected = ((t.durationSeconds ?? 600) * 1000) / FAMILY_TIME_FACTOR;
      if (t.stoppedAt) {
        if (now - Date.parse(t.stoppedAt) >= UNUSUAL_STOP_MS)
          alert(
            `stop:${t.stoppedAt}`,
            `Arrêt inhabituel détecté pendant le trajet de ${t.childName}`,
          );
        continue;
      }
      const moving = now - started - (t.pausedMs ?? 0);
      t.location = pointAlong(t.route, Math.min(0.99, moving / expected));
      if (now - started > expected * 1.5)
        alert('long_trip', `Le trajet de ${t.childName} prend plus de temps que prévu`);
    }
  });
}

export function mountPrototypeRoutes(
  app: Hono<Env>,
  ctx: Ctx,
  auth: {
    userOf: (c: Context<Env>, role?: 'passenger' | 'driver') => User;
    adminOf: (c: Context<Env>) => AdminUser;
    idempotent: <T>(
      ctx: Ctx,
      c: Context<Env>,
      id: string,
      raw: unknown,
      run: () => T,
      required?: boolean,
    ) => Promise<T>;
  },
) {
  const { userOf, adminOf, idempotent } = auth;
  app.get('/prototype/catalog', (c) => {
    userOf(c);
    return c.json(ensurePrototype(ctx.store.state).catalog);
  });
  app.get('/prototype/wallet', (c) =>
    c.json(passengerWallet(ctx.store.state, userOf(c, 'passenger').id)),
  );
  app.post('/prototype/wallet/topup', async (c) => {
    const u = userOf(c, 'passenger');
    const input = z
      .object({ amount: cents.min(1000), providerId: text })
      .parse(await c.req.json());
    return c.json(
      await idempotent(ctx, c, u.id, input, () =>
        ctx.store.tx((s) => {
          const p = ensurePrototype(s);
          mustFind(
            p.catalog.payments,
            (x) =>
              x.id === input.providerId &&
              x.enabled &&
              (!x.cityIds.length || x.cityIds.includes(u.cityId)),
            'moyen de recharge',
          );
          const w = passengerWallet(s, u.id);
          const entry = {
            id: nextId(s, 'PW'),
            amount: input.amount,
            label: 'Recharge en attente de confirmation',
            status: 'pending' as const,
            at: ctx.clock.iso(),
            rideId: null,
            providerId: input.providerId,
          };
          w.entries.push(entry);
          log(
            ctx,
            s,
            u,
            'wallet.topup_created',
            entry.id,
            'Recharge de démonstration créée',
          );
          return entry;
        }),
      ),
    );
  });
  app.post('/prototype/wallet/:id/resolve', async (c) => {
    const u = userOf(c, 'passenger');
    const { outcome } = z
      .object({ outcome: z.enum(['confirmed', 'failed']) })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const w = passengerWallet(s, u.id);
        const e = mustFind(
          w.entries,
          (x) => x.id === c.req.param('id') && x.amount > 0,
          'recharge',
        );
        if (e.status !== 'pending') return w;
        e.status = outcome;
        const option = ensurePrototype(s).catalog.payments.find(
          (x) => x.id === e.providerId,
        );
        e.label = `Recharge ${option?.name ?? ''} · ${outcome === 'confirmed' ? 'confirmée' : 'refusée'}`;
        log(ctx, s, u, `wallet.topup_${outcome}`, e.id, e.label);
        return passengerWallet(s, u.id);
      }),
    );
  });
  app.get('/prototype/family', (c) =>
    c.json(family(ctx.store.state, userOf(c))),
  );
  app.post('/prototype/family/children', async (c) => {
    const u = userOf(c, 'passenger');
    const input = childSchema.parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        checkChildPhoto(s, u, input.photo);
        const child: FamilyChild = {
          ...input,
          id: nextId(s, 'CH'),
          passengerId: u.id,
        };
        ensurePrototype(s).children.push(child);
        log(ctx, s, u, 'family.child_added', child.id, 'Profil enfant ajouté');
        return child;
      }),
    );
  });
  app.put('/prototype/family/children/:id', async (c) => {
    const u = userOf(c, 'passenger');
    const input = childSchema.parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const p = ensurePrototype(s);
        const child = mustFind(
          p.children,
          (x) => x.id === c.req.param('id') && x.passengerId === u.id,
          'enfant',
        );
        checkChildPhoto(s, u, input.photo);
        Object.assign(child, input);
        // Upcoming trips show the current first name.
        for (const t of p.trips)
          if (t.childId === child.id && t.status === 'scheduled')
            t.childName = child.firstName;
        log(ctx, s, u, 'family.child_updated', child.id, 'Profil enfant modifié');
        return child;
      }),
    );
  });
  app.post('/prototype/family/subscribe', async (c) => {
    const u = userOf(c, 'passenger');
    const input = z.object({ planId: text }).parse(await c.req.json());
    return c.json(
      await idempotent(ctx, c, u.id, input, () =>
        ctx.store.tx((s) => addSubscription(ctx, s, u, input.planId)),
      ),
    );
  });
  app.post('/prototype/family/trips', async (c) => {
    const u = userOf(c, 'passenger');
    const input = z
      .object({
        childId: text,
        pickup: place,
        destination: place,
        pickupAt: z.iso.datetime(),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
        kind: z
          .enum(['home_school', 'school_home', 'activity_home', 'other'])
          .optional(),
      })
      .parse(await c.req.json());
    if (Date.parse(input.pickupAt) < ctx.clock.now())
      throw new DomainError('VALIDATION', 'Choisissez un horaire futur.');
    return c.json(
      await idempotent(ctx, c, u.id, input, () =>
        ctx.store.tx((s) => addTrip(ctx, s, u, input)),
      ),
    );
  });
  app.post('/prototype/family/example', (c) => {
    if (!ctx.config.devMode) throw new DomainError('FORBIDDEN');
    const actor = userOf(c);
    return c.json(
      ctx.store.tx((s) => {
        const u =
          actor.role === 'passenger'
            ? actor
            : mustFind(
                s.users,
                (x) => x.role === 'passenger' && x.cityId === actor.cityId,
                'cliente de démonstration',
              );
        const p = ensurePrototype(s);
        let child = p.children.find((x) => x.passengerId === u.id);
        if (!child)
          p.children.push(
            (child = {
              id: nextId(s, 'CH'),
              passengerId: u.id,
              firstName: 'Lina',
              age: 8,
              school: 'École Agdal',
              schoolPlace: { ...PLACES.agdal, label: 'École Agdal' },
              photo: null,
              notes: 'Attendre à l’entrée principale. Allergie aux arachides.',
              recipients: [
                {
                  id: 'mother',
                  name: u.firstName,
                  relationship: 'Mère',
                  verificationCode: '1234',
                },
                {
                  id: 'father',
                  name: 'Youssef',
                  relationship: 'Père',
                  verificationCode: '5678',
                },
              ],
            }),
          );
        let sub = p.subscriptions.find(
          (x) =>
            x.passengerId === u.id &&
            x.status === 'active' &&
            Date.parse(x.endsAt) > ctx.clock.now(),
        );
        if (!sub)
          sub = addSubscription(
            ctx,
            s,
            u,
            p.catalog.plans.find((x) => x.enabled)!.id,
          );
        if (actor.role === 'driver') {
          sub.driverId = actor.id;
          sub.driverName = `${actor.firstName} ${actor.lastName}`;
        }
        if (!p.trips.some((x) => x.passengerId === u.id && !closed(x.status)))
          addTrip(ctx, s, u, {
            childId: child.id,
            pickup: { ...PLACES.hayRiad, label: 'Maison' },
            destination: { ...PLACES.agdal, label: 'École Agdal' },
            pickupAt: new Date(ctx.clock.now() + 3600000).toISOString(),
            weekdays: [1, 2, 3, 4, 5],
            kind: 'home_school',
          });
        return family(s, actor);
      }),
    );
  });
  app.post('/prototype/family/trips/:id/advance', async (c) => {
    const u = userOf(c);
    const input = z
      .object({
        expectedStatus: z.enum([
          'scheduled',
          'en_route',
          'arrived',
          'picked_up',
          'in_progress',
        ]),
        proof: z.string().max(200).optional(),
        childName: z.string().optional(),
        recipientId: z.string().optional(),
        code: z.string().optional(),
      })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const p = ensurePrototype(s);
        const t = mustFind(
          p.trips,
          (x) =>
            x.id === c.req.param('id') &&
            (u.role === 'driver'
              ? x.driverId === u.id
              : x.passengerId === u.id),
          'trajet',
        );
        if (u.role === 'passenger' && !ctx.config.devMode)
          throw new DomainError('FORBIDDEN');
        if (t.status !== input.expectedStatus)
          throw new DomainError(
            'CONFLICT',
            'Le trajet a changé. Rechargez avant de continuer.',
          );
        const next = FAMILY_NEXT[t.status];
        if (!next) throw new DomainError('INVALID_TRANSITION');
        const child = mustFind(p.children, (x) => x.id === t.childId);
        if (next === 'arrived') {
          if (!input.proof)
            throw new DomainError(
              'VALIDATION',
              'Ajoutez la confirmation photo.',
            );
          if (input.proof === 'demo-arrival-photo' && !ctx.config.devMode)
            throw new DomainError('FORBIDDEN');
          if (input.proof !== 'demo-arrival-photo') {
            const photo = mustFind(
              s.uploads,
              (x) => x.id === input.proof && x.ownerId === u.id,
              'photo',
            );
            if (photo.purpose !== 'support_attachment' || !photo.mimeType.startsWith('image/'))
              throw new DomainError('VALIDATION', 'Ajoutez une photo d’arrivée.');
          }
          t.arrivalProof = input.proof;
        }
        if (next === 'picked_up') {
          if (
            input.childName?.trim().toLowerCase() !==
            child.firstName.toLowerCase()
          )
            throw new DomainError(
              'VALIDATION',
              'Confirmez le prénom de l’enfant après vérification.',
            );
          t.pickupVerified = true;
        }
        if (next === 'completed') {
          const recipient = mustFind(
            child.recipients,
            (x) => x.id === input.recipientId,
            'personne autorisée',
          );
          if (recipient.verificationCode !== input.code)
            throw new DomainError('VALIDATION', 'Code de remise incorrect.');
          t.recipientId = recipient.id;
        }
        if (next === 'en_route') {
          const driver = s.users.find((x) => x.id === t.driverId);
          const v = s.vehicles.find((x) => x.id === driver?.vehicleId);
          t.vehicle = v
            ? { make: v.make, model: v.model, color: v.color, plate: v.plate }
            : null;
        }
        t.status = next;
        (t.times ??= {})[next] = ctx.clock.iso();
        // Live position: movement along the route is driven by the family timers.
        t.location =
          next === 'completed' ? t.destination.location : t.pickup.location;
        const label = FAMILY_STATUS_LABELS[next];
        t.timeline.push({
          at: ctx.clock.iso(),
          label,
          location: t.location,
          ...(input.proof ? { proof: input.proof } : {}),
        });
        const recipient = child.recipients.find((x) => x.id === t.recipientId);
        const message: Record<string, string> = {
          en_route: `${t.driverName.split(' ')[0]} est en route pour récupérer ${child.firstName}`,
          arrived: `${t.driverName.split(' ')[0]} est arrivée · photo de confirmation envoyée`,
          picked_up: `${child.firstName} a été récupéré·e après vérification`,
          in_progress: `Trajet de ${child.firstName} en cours · suivez-le en direct`,
          completed: `${child.firstName} est arrivé·e · remis·e à ${recipient ? `${recipient.name} (${recipient.relationship})` : 'une personne autorisée'}`,
        };
        t.notifications.push({
          at: ctx.clock.iso(),
          title: message[next] ?? `${child.firstName} · ${label}`,
        });
        log(ctx, s, u, `family.${next}`, t.id, label);
        if (next === 'completed' && t.weekdays.length) {
          const date = new Date(t.pickupAt);
          do {
            date.setUTCDate(date.getUTCDate() + 1);
          } while (
            !t.weekdays.includes(date.getUTCDay()) ||
            date.getTime() <= ctx.clock.now()
          );
          const owner = mustFind(s.users, (x) => x.id === t.passengerId);
          const sub = p.subscriptions.find(
            (x) => x.passengerId === owner.id && x.status === 'active',
          );
          if (
            sub &&
            date.toISOString() < sub.endsAt &&
            p.trips.filter(
              (x) =>
                x.passengerId === owner.id &&
                x.pickupAt >= sub.startsAt &&
                x.pickupAt < sub.endsAt,
            ).length < sub.includedTrips
          )
            addTrip(ctx, s, owner, {
              childId: t.childId,
              pickup: t.pickup,
              destination: t.destination,
              pickupAt: date.toISOString(),
              weekdays: t.weekdays,
              kind: t.kind,
            });
        }
        return t;
      }),
    );
  });
  app.post('/prototype/family/trips/:id/incident', async (c) => {
    const u = userOf(c);
    const { message } = z.object({ message: text }).parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const t = mustFind(
          ensurePrototype(s).trips,
          (x) =>
            x.id === c.req.param('id') &&
            (u.role === 'driver'
              ? x.driverId === u.id
              : x.passengerId === u.id),
        );
        reportIncident(ctx, t, {
          at: ctx.clock.iso(),
          by: `${u.firstName} ${u.lastName}`,
          message,
          location: t.location,
          source: u.role === 'driver' ? 'driver' : 'parent',
        });
        log(ctx, s, u, 'family.incident', t.id, message);
        return t;
      }),
    );
  });
  // Demo only: freeze the vehicle to show the unusual-stop alert.
  app.post('/prototype/family/trips/:id/stop', async (c) => {
    if (!ctx.config.devMode) throw new DomainError('FORBIDDEN');
    const u = userOf(c);
    const { stopped } = z
      .object({ stopped: z.boolean() })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const t = mustFind(
          ensurePrototype(s).trips,
          (x) =>
            x.id === c.req.param('id') &&
            (u.role === 'driver'
              ? x.driverId === u.id
              : x.passengerId === u.id),
          'trajet',
        );
        if (t.status !== 'in_progress')
          throw new DomainError('CONFLICT', 'Le trajet n’est pas en cours.');
        const now = ctx.clock.now();
        if (stopped && !t.stoppedAt) t.stoppedAt = new Date(now).toISOString();
        if (!stopped && t.stoppedAt) {
          t.pausedMs = (t.pausedMs ?? 0) + now - Date.parse(t.stoppedAt);
          t.stoppedAt = null;
        }
        return t;
      }),
    );
  });
  app.post('/prototype/sos', async (c) => {
    const u = userOf(c);
    const input = z
      .object({
        rideId: z.string().nullable(),
        familyTripId: z.string().nullable(),
        location,
        contactName: text,
        contactPhone: z.string().trim().max(30).nullable().optional(),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(await c.req.json());
    if (!input.rideId && !input.familyTripId)
      throw new DomainError(
        'VALIDATION',
        'Une course doit être associée à l’alerte.',
      );
    return c.json(
      await idempotent(ctx, c, u.id, input, () =>
        ctx.store.tx((s) => {
          const ride = input.rideId
            ? mustFind(
                s.rides,
                (x) =>
                  x.id === input.rideId &&
                  (x.passengerId === u.id || x.driverId === u.id),
                'course',
              )
            : null;
          const trip = input.familyTripId
            ? mustFind(
                ensurePrototype(s).trips,
                (x) =>
                  x.id === input.familyTripId &&
                  (x.passengerId === u.id || x.driverId === u.id),
                'trajet',
              )
            : null;
          const name = (id: string | null | undefined) => {
            const x = s.users.find((y) => y.id === id);
            return x ? `${x.firstName} ${x.lastName}` : null;
          };
          const passengerId = ride?.passengerId ?? trip?.passengerId ?? null;
          const driverId = ride?.driverId ?? trip?.driverId ?? null;
          const alert = {
            ...input,
            contactPhone: input.contactPhone || null,
            note: input.note || null,
            passengerId,
            passengerName: name(passengerId),
            driverId,
            driverName: name(driverId),
            vehiclePlate:
              ride?.driver?.vehicle.plate ?? trip?.vehicle?.plate ?? null,
            ticketId: null,
            id: nextId(s, 'SOS'),
            userId: u.id,
            userName: `${u.firstName} ${u.lastName}`,
            role: u.role,
            createdAt: ctx.clock.iso(),
            status: 'new' as const,
            actions: [
              {
                at: ctx.clock.iso(),
                by: u.firstName,
                label: 'Situation dangereuse signalée à Naya · position enregistrée',
              },
            ],
          };
          ensurePrototype(s).alerts.push(alert);
          log(ctx, s, u, 'sos.created', alert.id, 'Alerte SOS déclenchée');
          return alert;
        }),
      ),
    );
  });
  app.get('/prototype/sos', (c) => {
    const u = userOf(c);
    return c.json(
      ensurePrototype(ctx.store.state).alerts.filter((x) => x.userId === u.id),
    );
  });
  app.post('/prototype/sos/:id/action', async (c) => {
    const u = userOf(c);
    const { action } = z
      .object({
        action: z.enum([
          'emergency_call',
          'share_location',
          'trusted_contact',
          'support',
        ]),
      })
      .parse(await c.req.json());
    const own = mustFind(
      ensurePrototype(ctx.store.state).alerts,
      (x) => x.id === c.req.param('id') && x.userId === u.id,
      'alerte',
    );
    // One safety ticket per alert, linked to the ride so support sees its context.
    const ticket =
      action === 'support' && !own.ticketId
        ? createTicket(ctx, u, {
            reasonId: 'security',
            category: 'safety',
            rideId: own.rideId,
            subject: `SOS ${own.id} · demande d’aide`,
            body: `Alerte ${own.id} déclenchée pendant ${own.rideId ? `la course ${own.rideId}` : `le trajet ${own.familyTripId}`}. Position : ${own.location.lat.toFixed(5)}, ${own.location.lng.toFixed(5)}.${own.note ? ` Message : ${own.note}` : ''}`,
            attachments: [],
          })
        : null;
    return c.json(
      ctx.store.tx((s) => {
        const a = mustFind(
          ensurePrototype(s).alerts,
          (x) => x.id === own.id,
        );
        if (ticket) a.ticketId = ticket.id;
        const label =
          action === 'support' && a.ticketId
            ? `${SAFETY_ACTION_LABELS.support} · demande ${a.ticketId}`
            : SAFETY_ACTION_LABELS[action];
        a.actions.push({ at: ctx.clock.iso(), by: u.firstName, label });
        log(ctx, s, u, 'sos.action', a.id, label);
        return a;
      }),
    );
  });
  app.get('/admin/prototype', (c) => {
    requirePermission(adminOf(c), 'config.edit');
    const s = ctx.store.state;
    return c.json({
      ...ensurePrototype(s),
      people: s.users.map((x) => ({
        id: x.id,
        name: `${x.firstName} ${x.lastName}`,
        role: x.role,
        cityId: x.cityId,
      })),
      dedicatedDrivers: dedicatedDrivers(s),
    });
  });
  app.post('/admin/prototype/subscriptions/:id/status', async (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'config.edit');
    const input = z
      .object({
        status: z.enum(['active', 'paused', 'cancelled']),
        reason: z.string().trim().min(5, 'Motif requis (5 caractères minimum).').max(300),
      })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const sub = mustFind(ensurePrototype(s).subscriptions, (x) => x.id === c.req.param('id'), 'abonnement');
        if (sub.status === 'cancelled') throw new DomainError('INVALID_TRANSITION', 'Un abonnement résilié ne peut pas être réactivé.');
        if (sub.status === input.status) return sub;
        sub.status = input.status;
        (sub.statusHistory ??= []).push({ at: ctx.clock.iso(), by: admin.name, status: input.status, reason: input.reason });
        log(ctx, s, admin, `family.subscription_${input.status}`, sub.id, `Abonnement ${SUBSCRIPTION_STATUS_LABELS[input.status].toLowerCase()} · ${input.reason}`);
        return sub;
      }),
    );
  });
  app.post('/admin/prototype/family-availability/:id', async (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'config.edit');
    const { available } = z.object({ available: z.boolean() }).parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const d = mustFind(s.users, (x) => x.id === c.req.param('id') && x.role === 'driver', 'chauffeuse');
        (ensurePrototype(s).familyAvailability ??= {})[d.id] = available;
        log(ctx, s, admin, 'family.availability', d.id, `${d.firstName} ${d.lastName} · ${available ? 'disponible' : 'indisponible'} pour de nouvelles familles`);
        return dedicatedDrivers(s).find((x) => x.id === d.id);
      }),
    );
  });
  app.put('/admin/prototype/catalog/:kind', async (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'config.edit');
    const kind = c.req.param('kind');
    const raw = await c.req.json();
    const schemas = {
      categories: categorySchema,
      plans: planSchema,
      reasons: reasonSchema,
      payments: paymentSchema,
    };
    if (!(kind in schemas)) throw new DomainError('VALIDATION');
    const row = schemas[kind as keyof typeof schemas].parse(raw);
    return c.json(
      ctx.store.tx((s) => {
        const p = ensurePrototype(s);
        const list = p.catalog[kind as keyof typeof schemas] as {
          id: string;
        }[];
        const index = list.findIndex((x) => x.id === row.id);
        if (index < 0) list.push(row);
        else list[index] = row;
        p.catalog.version++;
        prototypeProviders(s, true);
        log(
          ctx,
          s,
          admin,
          'catalog.updated',
          row.id,
          `${kind} · configuration mise à jour`,
        );
        return p.catalog;
      }),
    );
  });
  app.post('/admin/prototype/alerts/:id', async (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'config.edit');
    const input = z
      .object({ status: z.enum(['new', 'responding', 'resolved']), note: text })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const a = mustFind(
          ensurePrototype(s).alerts,
          (x) => x.id === c.req.param('id'),
        );
        a.status = input.status;
        a.actions.push({
          at: ctx.clock.iso(),
          by: admin.name,
          label: input.note,
        });
        log(ctx, s, admin, 'sos.updated', a.id, input.note);
        return a;
      }),
    );
  });
  app.post('/admin/prototype/assignment/:id', async (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'config.edit');
    const { driverId } = z.object({ driverId: text }).parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const p = ensurePrototype(s);
        const sub = mustFind(
          p.subscriptions,
          (x) => x.id === c.req.param('id'),
        );
        const owner = mustFind(s.users, (x) => x.id === sub.passengerId);
        const d = mustFind(
          s.users,
          (x) =>
            x.id === driverId &&
            x.role === 'driver' &&
            x.cityId === owner.cityId &&
            x.status === 'active' &&
            s.cases.some(
              (v) => v.id === x.identityCaseId && v.status === 'approved',
            ) &&
            s.cases.some(
              (v) =>
                v.userId === x.id &&
                v.subject === 'vehicle' &&
                v.status === 'approved',
            ),
          'chauffeuse vérifiée de la ville',
        );
        sub.driverId = d.id;
        sub.driverName = `${d.firstName} ${d.lastName}`;
        for (const t of p.trips.filter(
          (t) => t.passengerId === sub.passengerId && t.status === 'scheduled',
        )) {
          t.driverId = d.id;
          t.driverName = sub.driverName;
        }
        log(
          ctx,
          s,
          admin,
          'family.assigned',
          sub.id,
          'Chauffeuse dédiée réassignée',
        );
        return sub;
      }),
    );
  });
  app.post('/admin/prototype/driver-categories/:id', async (c) => {
    const admin = adminOf(c);
    requirePermission(admin, 'config.edit');
    const { categoryIds } = z
      .object({ categoryIds: z.array(text) })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        mustFind(
          s.users,
          (x) => x.id === c.req.param('id') && x.role === 'driver',
        );
        const p = ensurePrototype(s);
        for (const id of categoryIds)
          mustFind(p.catalog.categories, (x) => x.id === id);
        p.driverCategories[c.req.param('id')] = categoryIds;
        log(
          ctx,
          s,
          admin,
          'driver.categories',
          c.req.param('id'),
          'Catégories autorisées modifiées',
        );
        return { ok: true };
      }),
    );
  });
}
