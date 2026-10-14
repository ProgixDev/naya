import {
  assertWashStartAllowed,
  CAR_WASH_DEMO_CONFIG,
  carWashRulesFor,
  defaultPrototypeCatalog,
  DomainError,
  formatMoney,
  haversineMeters,
  isInService,
  isWashOpen,
  pointAlong,
  priceWash,
  toCasablancaParts,
  washCancellationPreview,
  washEndAt,
  washOrderMachine,
  WASH_CANCEL_REASONS,
  WASH_STATUS_LABELS,
  type CancelInput,
  type CarWashCityRules,
  type CreateWashOrderInput,
  type LatLng,
  type Payment,
  type User,
  type WashOrder,
  type WashPaymentOption,
  type WashPaymentRef,
  type WashPhoto,
} from '@naya/domain';
import type { Ctx } from '../context';
import type { State } from '../state';
import { mustFind, nextId } from '../store';
import { appendAudit, SYSTEM } from '../audit';
import { postLedger, walletOf } from './finance';
import { prototypeMethods, releasePassengerWallet, reservePassengerWallet, settlePassengerWallet } from './prototype';
import { bookableCity, queueCardOutcome } from './rides';

/**
 * « Lavage à domicile ». Customers (passengers and drivers) order a wash where their car is
 * parked. There is no washer app yet: the demo engine below plays the washing team
 * (assignment, travel, washing, photos), driven by `tick()` against the clock.
 */

export interface CarWashState {
  orders: WashOrder[];
  /** Round-robin pointer over the demo teams. */
  teamCursor: number;
}

/** Created lazily on first use, so existing stores keep working without a reseed (ADR-0029). */
export function ensureCarWash(s: State): CarWashState {
  return (s.carWash ??= { orders: [], teamCursor: 0 });
}

const ENGINE = CAR_WASH_DEMO_CONFIG.engine;
const actorOf = (u: User) => ({ type: 'user' as const, id: u.id, name: `${u.firstName} ${u.lastName}` });
const tl = (o: WashOrder, at: string, type: string, label: string) => o.timeline.push({ at, type, label });
const reasonLabel = (code: string, text?: string | null) => (code === 'other' && text ? text : (WASH_CANCEL_REASONS.find((r) => r.code === code)?.label ?? code));

function rulesOrThrow(s: State, cityId: string): CarWashCityRules {
  const rules = carWashRulesFor(cityId);
  if (!rules) {
    const city = s.cities.find((c) => c.id === cityId);
    throw new DomainError('CITY_INACTIVE', `Le lavage à domicile n’est pas encore proposé à ${city?.name ?? cityId}.`);
  }
  return rules;
}

/* ───────────── Catalog and payment options (reads, no state change) ───────────── */

export function washCatalog(s: State, cityId: string) {
  const city = mustFind(s.cities, (c) => c.id === cityId && c.status !== 'inactive', 'ville');
  const rules = carWashRulesFor(city.id);
  if (!rules) return { cityId: city.id, cityName: city.name, available: false as const, placeholder: true as const };
  return {
    cityId: city.id,
    cityName: city.name,
    available: true as const,
    placeholder: CAR_WASH_DEMO_CONFIG.placeholder,
    rulesVersion: rules.version,
    packages: rules.packages.filter((p) => p.enabled),
    scheduling: rules.scheduling,
    nowEtaMinutes: rules.nowEtaMinutes,
    cancellation: rules.cancellation,
  };
}

const driverWalletId = (u: User) => `driver-wallet-${u.id}`;
const driverCashId = (u: User) => `driver-cash-${u.id}`;

/** Methods a customer may pay a wash with in this city. Passengers: their saved methods. Drivers: wallet or cash. */
export function washPaymentOptions(s: State, user: User, cityId: string, at: string): WashPaymentOption[] {
  if (user.role === 'driver') {
    const wallet = walletOf(s, user.id, at);
    return [
      { id: driverWalletId(user), kind: 'driver_wallet', label: 'Portefeuille chauffeuse', available: wallet.available > 0, note: `Disponible : ${formatMoney(wallet.available)}`, isDefault: wallet.available > 0 },
      { id: driverCashId(user), kind: 'cash', label: 'Espèces à l’équipe de lavage', available: true, note: 'À régler à la fin du lavage', isDefault: wallet.available <= 0 },
    ];
  }
  const rideProviders = new Set(s.providers.filter((p) => p.cityId === cityId && p.purpose === 'ride' && p.enabled && p.configured).map((p) => p.kind));
  const mobileOn = (s.prototype?.catalog ?? defaultPrototypeCatalog()).payments.some((p) => p.kind === 'mobile' && p.enabled && (!p.cityIds.length || p.cityIds.includes(cityId)));
  const wallet = s.prototype?.wallets.find((w) => w.userId === user.id);
  const walletAvailable = wallet ? wallet.entries.filter((e) => e.status === 'confirmed').reduce((n, e) => n + e.amount, 0) + wallet.entries.filter((e) => e.status === 'pending' && e.amount < 0).reduce((n, e) => n + e.amount, 0) : 0;
  const own = s.paymentMethods.filter((p) => p.userId === user.id);
  const options: WashPaymentOption[] = own.map((m) => ({
    id: m.id,
    kind: m.kind,
    label: m.label,
    available: m.kind === 'wallet' ? walletAvailable > 0 : m.kind === 'mobile_wallet' ? mobileOn : rideProviders.has(m.kind),
    note: m.kind === 'cash' ? 'À régler à l’équipe à la fin du lavage' : m.kind === 'wallet' ? `Disponible : ${formatMoney(Math.max(0, walletAvailable))}` : m.kind === 'card' ? 'Débitée à la fin du lavage' : 'Débité à la fin du lavage',
    isDefault: m.isDefault,
  }));
  // The wallet methods are created on first use (see prototypeMethods); list them before they exist.
  if (!own.some((m) => m.kind === 'wallet')) options.push({ id: `wallet-${user.id}`, kind: 'wallet', label: 'Portefeuille Naya', available: walletAvailable > 0, note: `Disponible : ${formatMoney(Math.max(0, walletAvailable))}`, isDefault: false });
  if (!own.some((m) => m.kind === 'mobile_wallet')) options.push({ id: `mobile-${user.id}`, kind: 'mobile_wallet', label: 'Wallet marocain', available: mobileOn, note: 'Débité à la fin du lavage', isDefault: false });
  return options;
}

function resolvePayment(s: State, user: User, paymentMethodId: string, cityId: string, price: number, at: string): WashPaymentRef {
  const option = washPaymentOptions(s, user, cityId, at).find((o) => o.id === paymentMethodId);
  if (!option) throw new DomainError('NOT_FOUND', 'Moyen de paiement introuvable.');
  if (option.kind === 'driver_wallet') {
    if (walletOf(s, user.id, at).available < price) throw new DomainError('INSUFFICIENT_AVAILABLE', 'Solde du portefeuille insuffisant pour ce lavage. Rechargez ou payez en espèces.');
    return { id: option.id, kind: option.kind, label: option.label };
  }
  if (!option.available && option.kind !== 'wallet') throw new DomainError('PAYMENT_METHOD_UNAVAILABLE');
  if (user.role === 'passenger') prototypeMethods(s, user); // materialises the wallet methods inside the transaction
  return { id: option.id, kind: option.kind, label: option.label };
}

/* ───────────── Booking ───────────── */

export function createWashOrder(ctx: Ctx, user: User, input: CreateWashOrderInput): WashOrder {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const now = new Date(nowMs).toISOString();
    const state = ensureCarWash(s);
    if (user.status !== 'active') throw new DomainError('FORBIDDEN', 'Votre compte est suspendu.');
    if (user.role === 'passenger') {
      const c = s.cases.find((x) => x.id === user.identityCaseId);
      if (c?.status !== 'approved') throw new DomainError('VERIFICATION_REQUIRED', 'Votre identité doit être validée avant de commander un lavage.');
    }
    const city = bookableCity(s, user, input.cityId);
    const rules = rulesOrThrow(s, city.id);
    if (!isInService(input.location.location, s.zones.filter((z) => z.cityId === city.id))) {
      throw new DomainError('OUT_OF_ZONE', `${input.location.label} est en dehors de la zone desservie à ${city.name}.`);
    }
    const open = state.orders.filter((o) => o.customerId === user.id && isWashOpen(o.status)).length;
    if (open >= rules.maxOpenOrders) throw new DomainError('CONFLICT', `Vous avez déjà ${open} lavages en cours ou planifiés.`);
    const price = priceWash(rules, input.packageId);
    if (input.expectedPrice !== price.price) {
      throw new DomainError('CONFLICT', `Le prix de cette formule est maintenant de ${formatMoney(price.price)}.`, { price: price.price });
    }
    let startAt: string;
    if (input.timing === 'scheduled') {
      assertWashStartAllowed(input.startAt!, rules.scheduling, price.durationMinutes, nowMs);
      startAt = new Date(Date.parse(input.startAt!)).toISOString();
    } else {
      startAt = new Date(nowMs + rules.nowEtaMinutes * 60_000).toISOString();
      const local = toCasablancaParts(startAt).time;
      const end = toCasablancaParts(washEndAt(startAt, price.durationMinutes)).time;
      if (local < rules.scheduling.openingTime || end > rules.scheduling.closingTime || end < local) {
        throw new DomainError('VALIDATION', `Les équipes passent de ${rules.scheduling.openingTime.replace(':', 'h')} à ${rules.scheduling.closingTime.replace(':', 'h')}. Planifiez un créneau.`);
      }
    }
    let vehicleId: string | null = null;
    if (input.vehicleId) {
      if (user.role !== 'driver') throw new DomainError('VALIDATION', 'Véhicule inconnu.');
      vehicleId = mustFind(s.vehicles, (v) => v.id === input.vehicleId && v.driverId === user.id, 'véhicule').id;
    }
    const paymentMethod = resolvePayment(s, user, input.paymentMethodId, city.id, price.price, now);
    const order: WashOrder = {
      id: nextId(s, 'LV'),
      cityId: city.id,
      customerId: user.id,
      customerRole: user.role,
      customerFirstName: user.firstName,
      location: input.location,
      parkingNotes: input.parkingNotes,
      car: input.car,
      vehicleId,
      terms: {
        cityId: city.id,
        rulesVersion: rules.version,
        packageId: price.package.id,
        packageName: price.package.name,
        includes: price.package.includes,
        durationMinutes: price.durationMinutes,
        price: price.price,
        commissionBp: rules.commissionBp,
        cancellation: rules.cancellation,
        currency: 'MAD',
        acceptedAt: now,
      },
      timing: input.timing,
      startAt,
      endAt: washEndAt(startAt, price.durationMinutes),
      paymentMethod,
      paymentId: null,
      status: 'booked',
      team: null,
      teamBase: null,
      teamLocation: null,
      photos: [],
      createdAt: now,
      assignedAt: null,
      departedAt: null,
      startedAt: null,
      completedAt: null,
      cancellation: null,
      rating: null,
      timeline: [],
      simulated: true,
    };
    tl(order, now, 'booked', input.timing === 'now' ? 'Lavage réservé · dès que possible' : 'Lavage réservé · créneau confirmé');
    if (paymentMethod.kind === 'wallet') reservePassengerWallet(s, user.id, order.id, price.price, now);
    if (paymentMethod.kind === 'driver_wallet') {
      postLedger(s, now, { driverId: user.id, type: 'car_wash', amount: -price.price, description: `Lavage à domicile ${order.id} · ${price.package.name}`, idempotencyKey: `wash:${order.id}:charge` });
      tl(order, now, 'payment.debited', `Portefeuille débité · ${formatMoney(price.price)}`);
    }
    state.orders.push(order);
    appendAudit(s, now, { actor: actorOf(user), action: 'car_wash.booked', entityType: 'car_wash', entityId: order.id, cityId: city.id, summary: `Lavage ${price.package.name} réservé · ${formatMoney(price.price)} · ${paymentMethod.label}` });
    return order;
  });
}

/* ───────────── Customer actions ───────────── */

function ownOrder(s: State, user: User, id: string) {
  const o = mustFind(ensureCarWash(s).orders, (x) => x.id === id, 'lavage');
  if (o.customerId !== user.id) throw new DomainError('FORBIDDEN');
  return o;
}

export function readWashOrder(s: State, user: User, id: string) {
  return mustFind(s.carWash?.orders ?? [], (x) => x.id === id && x.customerId === user.id, 'lavage');
}

export function washCancellationPreviewFor(ctx: Ctx, user: User, id: string) {
  return washCancellationPreview(readWashOrder(ctx.store.state, user, id), ctx.clock.now());
}

function newPayment(s: State, o: WashOrder, purpose: 'car_wash' | 'car_wash_fee', amount: number, at: string): Payment {
  const id = nextId(s, 'PY');
  const card = o.paymentMethod.kind === 'card';
  const payment: Payment = {
    id,
    rideId: null,
    washOrderId: o.id,
    payerId: o.customerId,
    purpose,
    method: o.paymentMethod.kind === 'driver_wallet' ? 'wallet' : o.paymentMethod.kind,
    amount,
    status: 'pending',
    provider: card ? 'demo-card' : o.paymentMethod.kind === 'cash' ? 'cash' : o.paymentMethod.kind === 'driver_wallet' ? 'naya-driver-wallet' : o.paymentMethod.kind === 'wallet' ? 'naya-wallet-demo' : 'mobile-wallet-demo',
    providerRef: card ? `demo_py_${id}` : null,
    failureReason: null,
    createdAt: at,
    updatedAt: at,
  };
  s.payments.push(payment);
  o.paymentId = id;
  return payment;
}

export function cancelWashOrder(ctx: Ctx, user: User, id: string, input: CancelInput) {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const now = new Date(nowMs).toISOString();
    const o = ownOrder(s, user, id);
    const preview = washCancellationPreview(o, nowMs);
    if (preview.reason === 'not_cancellable') throw new DomainError('INVALID_TRANSITION', 'Ce lavage ne peut plus être annulé.');
    if (preview.fee > 0 && input.acknowledgedFee === undefined) {
      throw new DomainError('VALIDATION', 'Les frais d’annulation doivent être affichés avant confirmation.', { fee: preview.fee });
    }
    if (input.acknowledgedFee !== undefined && input.acknowledgedFee !== preview.fee) {
      throw new DomainError('CONFLICT', `Les frais d’annulation sont maintenant de ${formatMoney(preview.fee)}.`, { fee: preview.fee });
    }
    o.status = washOrderMachine.next(o.status, 'CUSTOMER_CANCEL');
    o.cancellation = { by: 'customer', reasonCode: input.reasonCode, reasonText: reasonLabel(input.reasonCode, input.reasonText), fee: preview.fee, at: now };
    o.teamLocation = null;
    tl(o, now, 'cancelled', preview.fee > 0 ? `Annulé · frais ${formatMoney(preview.fee)}` : 'Annulé · sans frais');
    settleCancellation(ctx, s, o, preview.fee, now);
    appendAudit(s, now, { actor: actorOf(user), action: 'car_wash.cancelled', entityType: 'car_wash', entityId: o.id, cityId: o.cityId, reason: o.cancellation.reasonText, summary: `Lavage ${o.id} annulé · frais ${formatMoney(preview.fee)}` });
    return o;
  });
}

/** Releases what was held for the wash and charges the fee, if any, with the order's own method. */
function settleCancellation(ctx: Ctx, s: State, o: WashOrder, fee: number, at: string) {
  const kind = o.paymentMethod.kind;
  if (kind === 'wallet') releasePassengerWallet(s, o.customerId, o.id);
  if (kind === 'driver_wallet' && o.terms.price - fee > 0) {
    postLedger(s, at, { driverId: o.customerId, type: 'car_wash_refund', amount: o.terms.price - fee, description: fee > 0 ? `Remboursement lavage ${o.id} · frais ${formatMoney(fee)} retenus` : `Remboursement lavage ${o.id}`, idempotencyKey: `wash:${o.id}:refund` });
    tl(o, at, 'payment.refunded', `Remboursé sur le portefeuille · ${formatMoney(o.terms.price - fee)}`);
  }
  if (fee <= 0) return;
  const p = newPayment(s, o, 'car_wash_fee', fee, at);
  if (kind === 'card') {
    const pm = s.paymentMethods.find((m) => m.id === o.paymentMethod.id);
    queueCardOutcome(s, ctx, p.providerRef!, pm?.providerToken ?? null);
  } else if (kind === 'wallet') {
    settlePassengerWallet(s, o.customerId, `${o.id}-fee`, fee, at);
    p.status = 'confirmed';
  } else if (kind === 'mobile_wallet' || kind === 'driver_wallet') {
    p.status = 'confirmed';
  }
  // Cash: the fee stays pending, to be settled with support (no stored balance to take it from).
}

export function rateWashOrder(ctx: Ctx, user: User, id: string, stars: number, comment: string | null) {
  return ctx.store.tx((s) => {
    const o = ownOrder(s, user, id);
    if (o.status !== 'completed') throw new DomainError('INVALID_TRANSITION', 'Vous pourrez noter le lavage une fois terminé.');
    if (o.rating) throw new DomainError('CONFLICT', 'Ce lavage a déjà été noté.');
    const at = ctx.clock.iso();
    o.rating = { stars, comment, at };
    tl(o, at, 'rated', `Noté ${stars}/5`);
    return o;
  });
}

/* ───────────── Read model: where the team is ───────────── */

export function withWashTracking(o: WashOrder, nowMs: number): WashOrder {
  if (o.status === 'en_route' && o.teamBase && o.departedAt) {
    const t = Math.min(0.97, Math.max(0, (nowMs - Date.parse(o.departedAt)) / (ENGINE.travelSeconds * 1000)));
    const location = pointAlong([o.teamBase, o.location.location], t);
    // City speed ≈ 24 km/h for the estimate shown to the customer.
    const etaMinutes = Math.max(1, Math.ceil(haversineMeters(location, o.location.location) / 400));
    return { ...o, teamLocation: { location, at: new Date(nowMs).toISOString(), source: 'demo', etaMinutes } };
  }
  if (o.status === 'washing') return { ...o, teamLocation: { location: o.location.location, at: new Date(nowMs).toISOString(), source: 'demo', etaMinutes: null } };
  return { ...o, teamLocation: null };
}

/* ───────────── Demo engine: the simulated washing team ───────────── */

function teamBaseNear(p: LatLng): LatLng {
  const d = ENGINE.startDistanceMeters / 111_320;
  return { lat: p.lat + d * 0.6, lng: p.lng - d * 0.8 };
}

/** When the order's next simulated step is due, or null when nothing is pending. */
function dueAt(o: WashOrder): number | null {
  switch (o.status) {
    case 'booked':
      return Date.parse(o.createdAt) + ENGINE.assignAfterSeconds * 1000;
    case 'washer_assigned':
      return o.timing === 'now' ? Date.parse(o.assignedAt!) + ENGINE.departAfterAssignSeconds * 1000 : Date.parse(o.startAt) - ENGINE.travelSeconds * 1000;
    case 'en_route':
      return Date.parse(o.departedAt!) + ENGINE.travelSeconds * 1000;
    case 'washing':
      return Date.parse(o.startedAt!) + (o.terms.durationMinutes * 60_000) / ENGINE.timeFactor;
    default:
      return null;
  }
}

/** The team's shots. No upload: the apps show the mock photos of @naya/assets (`mockPhotos`). */
const demoPhotos = (s: State, o: WashOrder, stage: WashPhoto['stage'], at: string): WashPhoto[] => {
  const word = stage === 'before' ? 'Avant' : 'Après';
  const shots = o.terms.packageId === 'exterior' ? ['carrosserie', 'jantes'] : ['carrosserie', 'habitacle'];
  return shots.map((what) => ({ id: nextId(s, 'LVP', 4), stage, uploadId: null, label: `${word} · ${what}`, at }));
};

export function hasDueCarWashTimers(s: State, nowMs: number) {
  return (s.carWash?.orders ?? []).some((o) => {
    const due = dueAt(o);
    return due !== null && due <= nowMs;
  });
}

/** Advances every order whose next step is due, as many steps as the clock allows. */
export function runCarWashTimers(ctx: Ctx, s: State, nowMs: number): boolean {
  const state = ensureCarWash(s);
  let changed = false;
  for (const o of state.orders) {
    for (let due = dueAt(o); due !== null && due <= nowMs; due = dueAt(o)) {
      // Each step is stamped at the time it was due, so a large clock jump replays faithfully.
      const at = new Date(Math.max(due, Date.parse(o.timeline.at(-1)?.at ?? o.createdAt))).toISOString();
      step(ctx, s, state, o, at);
      changed = true;
    }
  }
  return changed;
}

function step(ctx: Ctx, s: State, state: CarWashState, o: WashOrder, at: string) {
  switch (o.status) {
    case 'booked': {
      const teams = CAR_WASH_DEMO_CONFIG.teams.filter((t) => t.cityId === o.cityId);
      if (!teams.length) {
        o.status = washOrderMachine.next(o.status, 'SYSTEM_CANCEL');
        o.cancellation = { by: 'system', reasonCode: 'no_team', reasonText: 'Aucune équipe de lavage disponible', fee: 0, at };
        tl(o, at, 'cancelled', 'Annulé · aucune équipe disponible, sans frais');
        settleCancellation(ctx, s, o, 0, at);
        return;
      }
      const team = teams[state.teamCursor++ % teams.length]!;
      o.status = washOrderMachine.next(o.status, 'ASSIGN');
      o.team = { id: team.id, name: team.name, ratingAverage: team.ratingAverage, vehicleLabel: team.vehicleLabel, phoneMasked: 'Appel masqué via Naya' };
      o.teamBase = teamBaseNear(o.location.location);
      o.assignedAt = at;
      tl(o, at, 'assigned', `${team.name} assignée à votre lavage`);
      appendAudit(s, at, { actor: SYSTEM, action: 'car_wash.assigned', entityType: 'car_wash', entityId: o.id, cityId: o.cityId, summary: `${team.name} assignée automatiquement` });
      return;
    }
    case 'washer_assigned':
      o.status = washOrderMachine.next(o.status, 'DEPART');
      o.departedAt = at;
      tl(o, at, 'departed', 'L’équipe de lavage est en route');
      return;
    case 'en_route':
      o.status = washOrderMachine.next(o.status, 'START');
      o.startedAt = at;
      o.photos.push(...demoPhotos(s, o, 'before', at));
      tl(o, at, 'started', 'Arrivée à la voiture · photos avant lavage · lavage commencé');
      return;
    case 'washing':
      o.status = washOrderMachine.next(o.status, 'COMPLETE');
      o.completedAt = at;
      o.photos.push(...demoPhotos(s, o, 'after', at));
      tl(o, at, 'completed', 'Lavage terminé · photos après lavage');
      settleWash(ctx, s, o, at);
      appendAudit(s, at, { actor: SYSTEM, action: 'car_wash.completed', entityType: 'car_wash', entityId: o.id, cityId: o.cityId, summary: `Lavage ${o.id} terminé · ${formatMoney(o.terms.price)} (${o.paymentMethod.label})` });
      return;
    default:
      return;
  }
}

/** Completion creates the payment with the order's method. Card: confirmed later by the provider. */
function settleWash(ctx: Ctx, s: State, o: WashOrder, at: string) {
  const p = newPayment(s, o, 'car_wash', o.terms.price, at);
  switch (o.paymentMethod.kind) {
    case 'card': {
      const pm = s.paymentMethods.find((m) => m.id === o.paymentMethod.id);
      queueCardOutcome(s, ctx, p.providerRef!, pm?.providerToken ?? null);
      tl(o, at, 'payment.pending', `Paiement carte en cours · ${formatMoney(p.amount)}`);
      return;
    }
    case 'wallet':
      settlePassengerWallet(s, o.customerId, o.id, o.terms.price, at);
      p.status = 'confirmed';
      tl(o, at, 'payment.confirmed', `Payé avec le portefeuille Naya · ${formatMoney(p.amount)}`);
      return;
    case 'driver_wallet':
      p.status = 'confirmed';
      tl(o, at, 'payment.confirmed', `Réglé par le portefeuille chauffeuse · ${formatMoney(p.amount)}`);
      return;
    case 'mobile_wallet':
      p.status = 'confirmed';
      tl(o, at, 'payment.confirmed', `Paiement mobile confirmé · ${formatMoney(p.amount)}`);
      return;
    case 'cash':
      p.status = 'confirmed';
      tl(o, at, 'payment.confirmed', `Espèces remises à l’équipe · ${formatMoney(p.amount)}`);
      return;
  }
}

/* ───────────── Admin (read-only) ───────────── */

export function adminWashOrders(s: State, cityId: string | undefined, nowMs: number) {
  return (s.carWash?.orders ?? [])
    .filter((o) => !cityId || o.cityId === cityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => {
      const customer = s.users.find((u) => u.id === o.customerId);
      return {
        order: withWashTracking(o, nowMs),
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : o.customerFirstName,
        payment: s.payments.find((p) => p.id === o.paymentId) ?? null,
        statusLabel: WASH_STATUS_LABELS[o.status],
      };
    });
}
