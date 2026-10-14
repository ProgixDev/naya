import { z } from 'zod';
import type { Hono, Context } from 'hono';
import {
  canReceiveFamilleTrips,
  canRespondToSafety,
  defaultPrototypeCatalog,
  DomainError,
  formatMoney,
  SAFETY_STATUS_LABELS,
  SAFETY_TRANSITIONS,
  type User,
  type AdminUser,
  type AdminSafetyAlert,
  type AuditActor,
  type DemoPaymentOption,
  type PrototypeState,
  type PassengerWallet,
  type PassengerWalletEntry,
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
/**
 * What the person did from the SOS sheet, as the alert and the safety desk read it. Builds from
 * before 14 Oct 2026 sent the « (simulation) » wording: it is recorded under today's.
 */
const SOS_ACTION_LABELS = {
  'Appel au 19 lancé': 'Appel au 19 lancé',
  'Position partagée avec un proche': 'Position partagée avec un proche',
  'Appel urgence simulé': 'Appel au 19 lancé',
  'Position partagée (simulation)': 'Position partagée avec un proche',
  'Contact de confiance alerté (simulation)': 'Contact de confiance prévenu',
  'Support contacté (simulation)': 'Support Naya contacté',
} as const;
type SosAction = keyof typeof SOS_ACTION_LABELS;
const SOS_ACTIONS = Object.keys(SOS_ACTION_LABELS) as [SosAction, ...SosAction[]];
export function ensurePrototype(s: State): PrototypeState {
  return (s.prototype ??= {
    catalog: defaultPrototypeCatalog(),
    children: [],
    subscriptions: [],
    trips: [],
    alerts: [],
    wallets: [],
    driverCategories: {},
    guardians: [],
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
/** The mock wallet provider, as the audit trail and the admin read it. */
const WALLET_PROVIDER: AuditActor = { type: 'provider', id: 'demo-provider', name: 'Prestataire de paiement' };
/**
 * Seconds the mock provider takes to answer a top-up: a card or mobile payment is authorised
 * within seconds, an agency counter (Cash Plus, Wafacash) a little later.
 */
function topupDelaySeconds(ctx: Ctx, kind: DemoPaymentOption['kind'] | undefined) {
  return kind === 'agency'
    ? ctx.config.providerDelaySeconds.withdrawalConfirm
    : ctx.config.providerDelaySeconds.payment;
}
function resolveTopup(
  s: State,
  entry: PassengerWalletEntry,
  outcome: 'confirmed' | 'failed',
  at: string,
  actor: AuditActor,
  cityId: string | null,
) {
  if (entry.status !== 'pending') return;
  entry.status = outcome;
  // Top-ups created before 14 Oct 2026 read « Recharge en attente de confirmation ».
  const option = ensurePrototype(s).catalog.payments.find((x) => x.id === entry.providerId);
  if (option) entry.label = `Recharge · ${option.name}`;
  appendAudit(s, at, {
    actor,
    action: `wallet.topup_${outcome}`,
    entityType: 'prototype',
    entityId: entry.id,
    cityId,
    summary: `${entry.label} · ${formatMoney(entry.amount)} ${outcome === 'confirmed' ? 'confirmée' : 'refusée'}`,
  });
}
/**
 * Answers the wallet top-ups whose provider delay has passed, like a provider callback would.
 * Called from tick() through deliverDueProviderJobs (finance.ts). Every top-up is accepted.
 */
export function settleDueWalletTopups(ctx: Ctx) {
  const now = ctx.clock.now();
  const due = (s: State) => {
    const p = s.prototype;
    if (!p) return [];
    const kinds = new Map(p.catalog.payments.map((o) => [o.id, o.kind]));
    return p.wallets.flatMap((w) =>
      w.entries
        .filter(
          (e) =>
            e.status === 'pending' &&
            e.amount > 0 &&
            !!e.providerId &&
            Date.parse(e.at) +
              topupDelaySeconds(ctx, kinds.get(e.providerId)) * 1000 <=
              now,
        )
        .map((e) => ({ userId: w.userId, entry: e })),
    );
  };
  if (due(ctx.store.state).length === 0) return 0;
  return ctx.store.tx((s) => {
    const at = new Date(now).toISOString();
    const list = due(s);
    for (const { userId, entry } of list) {
      const cityId = s.users.find((u) => u.id === userId)?.cityId ?? null;
      resolveTopup(s, entry, 'confirmed', at, WALLET_PROVIDER, cityId);
      passengerWallet(s, userId);
    }
    return list.length;
  });
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
      label: 'Wallet marocain',
    },
  ];
  for (const m of methods) {
    const existing = s.paymentMethods.find((x) => x.id === m.id);
    // Stores created before 14 Oct 2026 hold « Wallet marocain (démo) »: the label follows today's.
    if (existing) existing.label = m.label;
    else
      s.paymentMethods.push({
        ...m,
        userId: user.id,
        providerToken: null,
        last4: null,
        expMonth: null,
        expYear: null,
        isDefault: false,
      });
  }
  // Rides, receipts and car wash copy the label of the card they use (rides.ts paymentRef), so
  // it is cleaned here, before they read it.
  for (const m of s.paymentMethods)
    if (m.userId === user.id && m.kind === 'card') m.label = cardLabel(m.label);
  return p;
}
/**
 * Card labels as people read them. Stores seeded before 14 Oct 2026 hold « Carte de démonstration
 * •••• 4242 » or « Carte test refusée •••• 0002 », as do cards added through POST /payment-methods/card
 * before that date: they read « Carte •••• 4242 », the label new cards get (app.ts).
 */
export const cardLabel = (label: string) =>
  label.replace(/^Carte\s+(?:de\s+démonstration|test\b[^•]*?)\s*(•••• \d{4})$/i, 'Carte $1');
/** Provider names as people read them. Stores seeded before 14 Oct 2026 carry a « (démo) » suffix. */
export const providerName = (name: string) => name.replace(/\s*\(démo\)\s*$/i, '');
export function prototypeProviders(s: State, force = false) {
  const p = ensurePrototype(s);
  for (const provider of s.providers) provider.name = providerName(provider.name);
  for (const city of s.cities)
    for (const option of p.catalog.payments) {
      const id = `${city.id}-${option.id}-recharge`;
      let existing = s.providers.find((x) => x.id === id);
      // The city already has its own card recharge (seed.ts): a second « Carte bancaire » would
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
            name: option.name,
            enabled: false,
            mode: 'demo',
            configured: true,
          }),
        );
      existing.name = option.name;
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
          const option = mustFind(
            p.catalog.payments,
            (x) =>
              x.id === input.providerId &&
              x.enabled &&
              (!x.cityIds.length || x.cityIds.includes(u.cityId)),
            'moyen de recharge',
          );
          const w = passengerWallet(s, u.id);
          // Pending until the provider answers: settleDueWalletTopups, a few seconds later.
          const entry = {
            id: nextId(s, 'PW'),
            amount: input.amount,
            label: `Recharge · ${option.name}`,
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
            `Recharge ${formatMoney(input.amount)} demandée via ${option.name}`,
          );
          return entry;
        }),
      ),
    );
  });
  /**
   * Dev mode only (scenario tests): gives the provider's answer before its delay. The apps never
   * call it; top-ups are answered by settleDueWalletTopups.
   */
  app.post('/prototype/wallet/:id/resolve', async (c) => {
    const u = userOf(c, 'passenger');
    if (!ctx.config.devMode) throw new DomainError('NOT_FOUND');
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
        resolveTopup(s, e, outcome, ctx.clock.iso(), WALLET_PROVIDER, u.cityId);
        return passengerWallet(s, u.id);
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
                label: 'Alerte déclenchée · position enregistrée',
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
      .object({ action: z.enum(SOS_ACTIONS) })
      .parse(await c.req.json());
    const label = SOS_ACTION_LABELS[action];
    return c.json(
      ctx.store.tx((s) => {
        const a = mustFind(
          ensurePrototype(s).alerts,
          (x) => x.id === c.req.param('id') && x.userId === u.id,
        );
        a.actions.push({ at: ctx.clock.iso(), by: u.firstName, label });
        log(ctx, s, u, 'sos.action', a.id, label);
        return a;
      }),
    );
  });
  app.get('/admin/prototype', (c) => {
    requirePermission(adminOf(c), 'config.edit');
    const s = ctx.store.state;
    const p = ensurePrototype(s);
    return c.json({
      ...p,
      guardians: (p.guardians ?? []).map(({ tokenHash: _hidden, ...g }) => g),
      people: s.users.map((x) => ({
        id: x.id,
        name: `${x.firstName} ${x.lastName}`,
        role: x.role,
        cityId: x.cityId,
        ...(x.role === 'driver' ? { familleEligibility: x.familleEligibility ?? 'not_requested' } : {}),
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
            canReceiveFamilleTrips(x) &&
            s.cases.some(
              (v) => v.id === x.identityCaseId && v.status === 'approved',
            ) &&
            s.cases.some(
              (v) =>
                v.userId === x.id &&
                v.subject === 'vehicle' &&
                v.status === 'approved',
            ),
          'chauffeuse approuvée pour Naya Famille dans la ville',
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
