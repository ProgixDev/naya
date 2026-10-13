import { z } from 'zod';
import type { Hono, Context } from 'hono';
import {
  canRespondToSafety,
  defaultPrototypeCatalog,
  DomainError,
  FAMILY_NEXT,
  FAMILY_STATUS_LABELS,
  HANDOVER_MAX_ATTEMPTS,
  PLACES,
  SAFETY_STATUS_LABELS,
  SAFETY_TRANSITIONS,
  type User,
  type AdminUser,
  type AdminSafetyAlert,
  type PrototypeState,
  type PassengerWallet,
  type FamilyOverview,
  type FamilyTrip,
  type Place,
  type PrototypeCatalog,
  type SafetyAlert,
} from '@naya/domain';
import type { Principal } from './auth';
import type { State } from '../state';
import type { Ctx } from '../context';
import { mustFind, nextId } from '../store';
import { appendAudit } from '../audit';
import { requirePermission } from './permissions';

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
  id: text,
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
});
const planSchema = z.object({
  id: text,
  name: text,
  price: cents,
  durationDays: z.number().int().min(1).max(365),
  includedTrips: z.number().int().min(1).max(500),
  enabled: z.boolean(),
  features: z.array(text).min(1),
});
const reasonSchema = z.object({
  id: text,
  label: text,
  category: z.enum(['ride', 'payment', 'safety', 'account', 'wallet', 'other']),
  evidenceRequired: z.boolean(),
  enabled: z.boolean(),
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
  school: text,
  notes: z.string().trim().max(500),
  recipients: z
    .array(
      z.object({
        id: text,
        name: text,
        relationship: text,
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
  return (s.prototype ??= {
    catalog: defaultPrototypeCatalog(),
    children: [],
    subscriptions: [],
    trips: [],
    alerts: [],
    wallets: [],
    driverCategories: {},
  });
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
      // The city already has its own card recharge (seed.ts): a second « Carte bancaire (démo) » would
      // show twice in the driver's list. Stores that already got the copy keep it, disabled.
      if (
        option.kind === 'card' &&
        s.providers.some(
          (x) =>
            x.id !== id &&
            x.cityId === city.id &&
            x.purpose === 'recharge' &&
            x.kind === 'card',
        )
      ) {
        if (existing) existing.enabled = false;
        continue;
      }
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
function family(s: State, user: User): FamilyOverview {
  const p = ensurePrototype(s);
  const driver = user.role === 'driver';
  return {
    // Handover codes stay between the parent and the recipient: the chauffeuse gets
    // names and relationships only, and the server alone checks the code.
    children: p.children
      .filter((x) =>
        driver
          ? p.trips.some((t) => t.driverId === user.id && t.childId === x.id)
          : x.passengerId === user.id,
      )
      .map((x) =>
        driver
          ? {
              ...x,
              recipients: x.recipients.map((r) => ({
                id: r.id,
                name: r.name,
                relationship: r.relationship,
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
const HANDOVER_LOCKED = `Remise bloquée après ${HANDOVER_MAX_ATTEMPTS} codes incorrects. Ne confiez pas l’enfant : contactez la famille ou le support Naya.`;
/** Counts a wrong handover code; at the limit the handover is locked and recorded on the trip. */
function refuseHandover(ctx: Ctx, s: State, u: User, t: FamilyTrip) {
  t.handoverAttempts = (t.handoverAttempts ?? 0) + 1;
  const left = HANDOVER_MAX_ATTEMPTS - t.handoverAttempts;
  log(
    ctx,
    s,
    u,
    'family.handover_refused',
    t.id,
    `Code de remise incorrect (${t.handoverAttempts}/${HANDOVER_MAX_ATTEMPTS})`,
  );
  if (left > 0)
    return new DomainError(
      'VALIDATION',
      `Code de remise incorrect. ${left > 1 ? `${left} essais restants` : 'Dernier essai'} avant le blocage de la remise.`,
      { attemptsLeft: left },
    );
  const label = `Remise bloquée · ${HANDOVER_MAX_ATTEMPTS} codes incorrects`;
  t.handoverLocked = true;
  t.incident = label;
  t.timeline.push({ at: ctx.clock.iso(), label, location: t.location });
  t.notifications.push({
    at: ctx.clock.iso(),
    title: `${t.childName} · ${label}`,
  });
  log(ctx, s, u, 'family.handover_locked', t.id, label);
  return new DomainError('INVALID_TRANSITION', HANDOVER_LOCKED, {
    locked: true,
  });
}
/** The SOS queue as the safety desk reads it: reporter, city and the ride or family trip concerned. */
function adminAlert(s: State, a: SafetyAlert): AdminSafetyAlert {
  const reporter = s.users.find((x) => x.id === a.userId);
  const ride = a.rideId ? s.rides.find((x) => x.id === a.rideId) : undefined;
  const trip = a.familyTripId
    ? ensurePrototype(s).trips.find((x) => x.id === a.familyTripId)
    : undefined;
  const stops = ride?.route.stops ?? [];
  return {
    ...a,
    cityId: ride?.cityId ?? reporter?.cityId ?? null,
    reporterPhone: reporter?.phone ?? null,
    ride: ride
      ? {
          id: ride.id,
          status: ride.status,
          pickup: stops[0]?.label ?? '—',
          destination: stops[stops.length - 1]?.label ?? '—',
          passengerName: ride.passenger.firstName,
          driverName: ride.driver?.firstName ?? null,
        }
      : null,
    trip: trip
      ? {
          id: trip.id,
          childName: trip.childName,
          status: trip.status,
          driverName: trip.driverName,
          pickup: trip.pickup.label,
          destination: trip.destination.label,
        }
      : null,
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
  const driver = mustFind(
    s.users,
    (x) =>
      x.role === 'driver' &&
      x.cityId === user.cityId &&
      x.status === 'active' &&
      s.cases.some(
        (c) => c.id === x.identityCaseId && c.status === 'approved',
      ) &&
      s.cases.some(
        (c) =>
          c.userId === x.id &&
          c.subject === 'vehicle' &&
          c.status === 'approved',
      ),
    'chauffeuse vérifiée',
  );
  const current = p.subscriptions.find((x) => x.passengerId === user.id);
  if (
    current?.status === 'active' &&
    Date.parse(current.endsAt) > ctx.clock.now()
  )
    throw new DomainError('CONFLICT', 'Vous avez déjà un abonnement actif.');
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
  const trip: FamilyTrip = {
    ...input,
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
  /** SOS handling has its own permission (support agents hold it); see canRespondToSafety. */
  const safetyResponder = (c: Context<Env>) => {
    const admin = adminOf(c);
    if (!canRespondToSafety(admin.permissions))
      requirePermission(admin, 'safety.respond');
    return admin;
  };
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
        const child = { ...input, id: nextId(s, 'CH'), passengerId: u.id };
        ensurePrototype(s).children.push(child);
        log(ctx, s, u, 'family.child_added', child.id, 'Profil enfant ajouté');
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
              notes: 'Attendre à l’entrée principale.',
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
            pickup: PLACES.hayRiad,
            destination: PLACES.agdal,
            pickupAt: new Date(ctx.clock.now() + 3600000).toISOString(),
            weekdays: [1, 2, 3, 4, 5],
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
    // A wrong handover code must be counted even though the request fails: the
    // transaction returns the refusal (a throw would roll the count back).
    const result = ctx.store.tx(
      (s): { trip: FamilyTrip } | { refused: DomainError } => {
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
            if (
              photo.purpose !== 'support_attachment' ||
              !photo.mimeType.startsWith('image/')
            )
              throw new DomainError(
                'VALIDATION',
                'Ajoutez une photo d’arrivée.',
              );
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
              'Le prénom ne correspond pas. Demandez son prénom à l’enfant avant de confirmer.',
            );
          t.pickupVerified = true;
        }
        if (next === 'completed') {
          if (t.handoverLocked)
            throw new DomainError('INVALID_TRANSITION', HANDOVER_LOCKED, {
              locked: true,
            });
          const recipient = mustFind(
            child.recipients,
            (x) => x.id === input.recipientId,
            'personne autorisée',
          );
          // A blank or malformed entry is a typing slip, not a guess: it does not use up an attempt.
          if (!/^\d{4}$/.test(input.code ?? ''))
            throw new DomainError(
              'VALIDATION',
              'Saisissez le code à 4 chiffres de la personne autorisée.',
            );
          if (recipient.verificationCode !== input.code)
            return { refused: refuseHandover(ctx, s, u, t) };
          t.recipientId = recipient.id;
        }
        t.status = next;
        t.location =
          next === 'in_progress'
            ? {
                lat: (t.pickup.location.lat + t.destination.location.lat) / 2,
                lng: (t.pickup.location.lng + t.destination.location.lng) / 2,
              }
            : next === 'completed'
              ? t.destination.location
              : t.pickup.location;
        const label = FAMILY_STATUS_LABELS[next];
        t.timeline.push({
          at: ctx.clock.iso(),
          label,
          location: t.location,
          ...(input.proof ? { proof: input.proof } : {}),
        });
        t.notifications.push({
          at: ctx.clock.iso(),
          title: `${child.firstName} · ${label}`,
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
            });
        }
        return { trip: t };
      },
    );
    if ('refused' in result) throw result.refused;
    return c.json(result.trip);
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
        t.incident = message;
        t.notifications.push({ at: ctx.clock.iso(), title: message });
        t.timeline.push({
          at: ctx.clock.iso(),
          label: message,
          location: t.location,
        });
        log(ctx, s, u, 'family.incident', t.id, message);
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
          if (input.rideId)
            mustFind(
              s.rides,
              (x) =>
                x.id === input.rideId &&
                (x.passengerId === u.id || x.driverId === u.id),
              'course',
            );
          if (input.familyTripId)
            mustFind(
              ensurePrototype(s).trips,
              (x) =>
                x.id === input.familyTripId &&
                (x.passengerId === u.id || x.driverId === u.id),
              'trajet',
            );
          const alert = {
            ...input,
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
                label: 'Alerte de démonstration créée · position enregistrée',
              },
            ],
          };
          ensurePrototype(s).alerts.push(alert);
          log(ctx, s, u, 'sos.created', alert.id, 'Alerte SOS simulée');
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
          'Appel urgence simulé',
          'Position partagée (simulation)',
          'Contact de confiance alerté (simulation)',
          'Support contacté (simulation)',
        ]),
      })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const a = mustFind(
          ensurePrototype(s).alerts,
          (x) => x.id === c.req.param('id') && x.userId === u.id,
        );
        a.actions.push({ at: ctx.clock.iso(), by: u.firstName, label: action });
        log(ctx, s, u, 'sos.action', a.id, action);
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
    });
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
  app.get('/admin/prototype/alerts', (c) => {
    safetyResponder(c);
    const s = ctx.store.state;
    const rank = { new: 0, responding: 1, resolved: 2 };
    return c.json(
      ensurePrototype(s)
        .alerts.map((a) => adminAlert(s, a))
        // New first, then taken in charge, by order of arrival; resolved ones newest first.
        .sort(
          (a, b) =>
            rank[a.status] - rank[b.status] ||
            (a.status === 'resolved'
              ? b.createdAt.localeCompare(a.createdAt)
              : a.createdAt.localeCompare(b.createdAt)),
        ),
    );
  });
  app.post('/admin/prototype/alerts/:id', async (c) => {
    const admin = safetyResponder(c);
    const input = z
      .object({
        status: z.enum(['new', 'responding', 'resolved']),
        note: z.string().trim().max(300).optional(),
      })
      .parse(await c.req.json());
    return c.json(
      ctx.store.tx((s) => {
        const a = mustFind(
          ensurePrototype(s).alerts,
          (x) => x.id === c.req.param('id'),
          'alerte',
        );
        if (!SAFETY_TRANSITIONS[a.status].includes(input.status))
          throw new DomainError(
            'INVALID_TRANSITION',
            a.status === input.status
              ? `Cette alerte est déjà « ${SAFETY_STATUS_LABELS[a.status]} »${a.ownerName ? ` (${a.ownerName})` : ''}.`
              : `Cette alerte est « ${SAFETY_STATUS_LABELS[a.status]} » : elle ne peut pas passer à « ${SAFETY_STATUS_LABELS[input.status]} ».`,
            { from: a.status, to: input.status },
          );
        const note = input.note ?? '';
        if (input.status === 'resolved' && note.length < 3)
          throw new DomainError(
            'REASON_REQUIRED',
            'Ajoutez une note de résolution : ce qui a été fait et avec qui.',
          );
        const at = ctx.clock.iso();
        if (input.status === 'responding' || !a.ownerId) {
          a.ownerId = admin.id;
          a.ownerName = admin.name;
        }
        if (input.status === 'resolved') {
          a.resolvedAt = at;
          a.resolutionNote = note;
        }
        a.status = input.status;
        const label =
          input.status === 'resolved'
            ? `Alerte clôturée · ${note}`
            : note || 'Alerte prise en charge';
        a.actions.push({ at, by: admin.name, label });
        log(
          ctx,
          s,
          admin,
          input.status === 'resolved' ? 'sos.resolved' : 'sos.taken',
          a.id,
          label,
        );
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
