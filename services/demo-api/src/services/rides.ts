import {
  applyBp,
  assertModifiable,
  assertOfferAcceptable,
  assertPickupTimeAllowed,
  computeFare,
  demoRoute,
  DomainError,
  formatMoney,
  haversineMeters,
  isBlockedByDebt,
  isInService,
  isRideActive,
  NO_MULTIPLIER,
  offerMachine,
  passengerCancellationPreview,
  pointAlong,
  rideMachine,
  rideSettlement,
  scheduledMachine,
  splitFare,
  PASSENGER_CANCEL_REASONS,
  DRIVER_CANCEL_REASONS,
  OFFER_DECLINE_REASONS,
  type CancelInput,
  type CityConfig,
  type DriverOffer,
  type DriverSummary,
  type FrozenTerms,
  type LatLng,
  type ModifyScheduled,
  type Place,
  type Quote,
  type Ride,
  type RideTimelineEvent,
  type ScheduledBooking,
  type ServiceCategory,
  type User,
} from '@naya/domain';
import type { Ctx } from '../context';
import type { State } from '../state';
import { mustFind, nextId } from '../store';
import { appendAudit } from '../audit';
import { postLedger, queueProviderJob, walletOf } from './finance';
import { categoryFor, ensurePrototype, prototypeMethods, reservePassengerWallet, releasePassengerWallet, settlePassengerWallet, passengerWallet } from './prototype';

const STALE_AFTER_MS = 20_000;
/** Demo trips play 20× faster than real time so movement is visible in a demo. */
export const DEMO_TIME_FACTOR = 20;

const reasonLabel = (list: readonly { code: string; label: string }[], code: string, text?: string | null) =>
  code === 'other' && text ? text : (list.find((r) => r.code === code)?.label ?? code);

/* ───────────── Cities ───────────── */

export function bookableCity(s: State, user: User, cityId: string): CityConfig {
  const city = mustFind(s.cities, (c) => c.id === cityId, 'ville');
  if (city.status === 'inactive') throw new DomainError('CITY_INACTIVE');
  if (city.status === 'test' && !user.testerCities.includes(city.id)) {
    throw new DomainError('CITY_INACTIVE', `${city.name} est en phase de test : les réservations ne sont pas encore ouvertes.`);
  }
  return city;
}

export function rulesAtVersion(s: State, city: CityConfig, version: number) {
  return s.cityRuleVersions.find((v) => v.cityId === city.id && v.version === version)?.rules ?? city.rules;
}

/* ───────────── Quotes ───────────── */

export function createQuote(ctx: Ctx, user: User, cityId: string, stops: Place[], categoryId?: string): Quote {
  return ctx.store.tx((s) => {
    const city = bookableCity(s, user, cityId);
    const zones = s.zones.filter((z) => z.cityId === city.id);
    stops.forEach((p, index) => {
      if (!isInService(p.location, zones)) {
        throw new DomainError('OUT_OF_ZONE', `${p.label} est en dehors de la zone desservie à ${city.name}.`, { index });
      }
    });
    const category = categoryId ? categoryFor(s, cityId, categoryId) : null;
    // A category tariff left empty falls back to the city tariff.
    const fareRulesFor = (c: ServiceCategory | null) => c ? { ...city.rules, baseFare: c.baseFare ?? city.rules.baseFare, perKm: c.perKm ?? city.rules.perKm, perMinute: c.perMinute ?? city.rules.perMinute, minimumFare: c.minimumFare ?? city.rules.minimumFare } : city.rules;
    const route = demoRoute(stops);
    const multiplier = city.rules.dynamic.enabled ? city.rules.dynamic.multiplierBp : NO_MULTIPLIER;
    const now = ctx.clock.now();
    const options = ensurePrototype(s).catalog.categories
      .filter((c) => c.enabled && (!c.cityIds.length || c.cityIds.includes(city.id)))
      .map((c) => ({ id: c.id, name: c.name, description: c.description, icon: c.icon, etaMinutes: c.etaMinutes, conditions: c.conditions, total: computeFare(fareRulesFor(c), route.distanceMeters, route.durationSeconds, multiplier).total }));
    const quote: Quote = {
      ...(category ? { service: { id: category.id, name: category.name, icon: category.icon, etaMinutes: category.etaMinutes, commissionBp: category.commissionBp, conditions: category.conditions } } : {}),
      options,
      id: nextId(s, 'QT', 5),
      passengerId: user.id,
      cityId: city.id,
      currency: 'MAD',
      ruleVersion: city.rulesVersion,
      route,
      breakdown: computeFare(fareRulesFor(category), route.distanceMeters, route.durationSeconds, multiplier),
      conditions: {
        cancellation: city.rules.cancellation,
        dynamic: multiplier > NO_MULTIPLIER ? { multiplierBp: multiplier, reason: city.rules.dynamic.reason } : null,
        cityStatus: city.status,
      },
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + city.rules.quoteValiditySeconds * 1000).toISOString(),
      status: 'open',
    };
    s.quotes = s.quotes.filter((q) => q.status === 'open' || q.passengerId !== user.id).slice(-500);
    s.quotes.push(quote);
    return quote;
  });
}

function takeQuote(s: State, user: User, quoteId: string, nowMs: number) {
  const quote = mustFind(s.quotes, (q) => q.id === quoteId && q.passengerId === user.id, 'devis');
  if (quote.status !== 'open') throw new DomainError('CONFLICT', 'Ce devis a déjà été utilisé.');
  if (Date.parse(quote.expiresAt) <= nowMs) throw new DomainError('QUOTE_EXPIRED');
  const city = bookableCity(s, user, quote.cityId);
  if (quote.service) categoryFor(s, quote.cityId, quote.service.id);
  quote.status = 'used';
  return { quote, city };
}

function freezeTerms(s: State, quote: Quote, city: CityConfig, at: string): FrozenTerms {
  const rules = rulesAtVersion(s, city, quote.ruleVersion);
  return {
    service: quote.service,
    quoteId: quote.id,
    cityId: quote.cityId,
    currency: quote.currency,
    ruleVersion: quote.ruleVersion,
    breakdown: quote.breakdown,
    commissionBp: quote.service?.commissionBp ?? rules.commissionBp,
    cancellation: quote.conditions.cancellation,
    dynamic: quote.conditions.dynamic,
    acceptedAt: at,
  };
}

function requireVerifiedPassenger(s: State, user: User) {
  const c = s.cases.find((x) => x.id === user.identityCaseId);
  if (c?.status !== 'approved') throw new DomainError('VERIFICATION_REQUIRED');
}

function paymentRef(s: State, user: User, paymentMethodId: string, cityId: string) {
  prototypeMethods(s, user);
  const pm = mustFind(s.paymentMethods, (p) => p.id === paymentMethodId && p.userId === user.id, 'moyen de paiement');
  if (pm.kind === 'wallet') return { id: pm.id, kind: pm.kind, label: pm.label };
  if (pm.kind === 'mobile_wallet') {
    if (!s.providers.some((p) => p.cityId === cityId && p.purpose === 'ride' && p.kind === 'mobile_wallet' && p.enabled && p.configured)) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE');
    return { id: pm.id, kind: pm.kind, label: pm.label };
  }
  const provider = s.providers.find((p) => p.cityId === cityId && p.purpose === 'ride' && p.kind === pm.kind && p.enabled && p.configured);
  if (!provider) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE');
  return { id: pm.id, kind: pm.kind, label: pm.label };
}

/* ───────────── Rides ───────────── */

const tl = (ride: Ride, at: string, type: string, actor: RideTimelineEvent['actor'], label: string) => ride.timeline.push({ at, type, actor, label });

export function nextRideId(s: State) {
  return nextId(s, 'NY');
}

function newRide(s: State, user: User, route: Ride['route'], terms: FrozenTerms, payment: Ride['paymentMethod'], now: string, scheduledBookingId: string | null): Ride {
  return {
    id: nextRideId(s),
    cityId: terms.cityId,
    passengerId: user.id,
    passenger: { id: user.id, firstName: user.firstName, ratingAverage: user.ratingAverage },
    driverId: null,
    driver: null,
    status: 'searching',
    route,
    terms,
    paymentMethod: payment,
    paymentId: null,
    completedStops: 0,
    requestedAt: now,
    searchStartedAt: now,
    assignedAt: null,
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancellation: null,
    driverCancellations: [],
    scheduledBookingId,
    rating: null,
    driverLocation: null,
    timeline: [{ at: now, type: 'requested', actor: 'passenger', label: scheduledBookingId ? 'Réservation planifiée lancée' : 'Course demandée' }],
    simulated: true,
  };
}

export function createRide(ctx: Ctx, user: User, quoteId: string, paymentMethodId: string): Ride {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const now = new Date(nowMs).toISOString();
    requireVerifiedPassenger(s, user);
    if (s.rides.some((r) => r.passengerId === user.id && isRideActive(r.status))) throw new DomainError('ACTIVE_RIDE_EXISTS');
    const { quote, city } = takeQuote(s, user, quoteId, nowMs);
    const payment = paymentRef(s, user, paymentMethodId, city.id);
    const ride = newRide(s, user, quote.route, freezeTerms(s, quote, city, now), payment, now, null);
    if (payment.kind === 'wallet') reservePassengerWallet(s, user.id, ride.id, ride.terms.breakdown.total, now);
    s.rides.push(ride);
    dispatch(s, ride, nowMs);
    return ride;
  });
}

/* ───────────── Driver eligibility and dispatch ───────────── */

export type EligibilityReason =
  | { code: 'identity_not_approved'; status: string }
  | { code: 'vehicle_not_approved'; status: string }
  | { code: 'debt_limit'; balance: number; limit: number }
  | { code: 'city_unavailable'; cityId: string }
  | { code: 'account_suspended' };

export function driverEligibility(s: State, driver: User, at: string) {
  const reasons: EligibilityReason[] = [];
  const person = s.cases.find((c) => c.id === driver.identityCaseId);
  const vehicle = s.cases.find((c) => c.userId === driver.id && c.subject === 'vehicle');
  if (driver.status !== 'active') reasons.push({ code: 'account_suspended' });
  if (person?.status !== 'approved') reasons.push({ code: 'identity_not_approved', status: person?.status ?? 'draft' });
  if (vehicle?.status !== 'approved') reasons.push({ code: 'vehicle_not_approved', status: vehicle?.status ?? 'draft' });
  const city = s.cities.find((c) => c.id === driver.cityId);
  if (!city || city.status === 'inactive' || (city.status === 'test' && !driver.testerCities.includes(city.id))) {
    reasons.push({ code: 'city_unavailable', cityId: driver.cityId });
  }
  if (city) {
    const w = walletOf(s, driver.id, at);
    if (isBlockedByDebt(w.balance, city.rules.debtLimit)) reasons.push({ code: 'debt_limit', balance: w.balance, limit: city.rules.debtLimit });
  }
  return { eligible: reasons.length === 0, reasons };
}

function driverSummary(s: State, driver: User): DriverSummary {
  const v = s.vehicles.find((x) => x.id === driver.vehicleId);
  return {
    id: driver.id,
    firstName: driver.firstName,
    lastInitial: driver.lastName.charAt(0),
    ratingAverage: driver.ratingAverage,
    phoneMasked: 'Appel masqué via Naya',
    vehicle: { make: v?.make ?? '', model: v?.model ?? '', color: v?.color ?? '', plate: v?.plate ?? '' },
  };
}

const busyDriverIds = (s: State) =>
  new Set([
    ...s.rides.filter((r) => r.driverId && (r.status === 'driver_assigned' || r.status === 'driver_arrived' || r.status === 'in_progress')).map((r) => r.driverId!),
    ...s.offers.filter((o) => o.status === 'pending').map((o) => o.driverId),
  ]);

/** Offers the ride to the nearest eligible online driver not yet tried for it. */
export function dispatch(s: State, ride: Ride, nowMs: number): DriverOffer | null {
  if (ride.status !== 'searching') return null;
  if (s.offers.some((o) => o.rideId === ride.id && o.status === 'pending')) return null;
  const now = new Date(nowMs).toISOString();
  const tried = new Set([...s.offers.filter((o) => o.rideId === ride.id).map((o) => o.driverId), ...ride.driverCancellations.map((d) => d.driverId)]);
  const busy = busyDriverIds(s);
  const pickup = ride.route.stops[0]!.location;
  const candidates = s.presence
    .filter((p) => p.online && !tried.has(p.driverId) && !busy.has(p.driverId))
    .map((p) => ({ p, driver: s.users.find((u) => u.id === p.driverId)! }))
    .filter(({ driver }) => driver && driver.cityId === ride.cityId && driverEligibility(s, driver, now).eligible && (ensurePrototype(s).driverCategories[driver.id] ?? ensurePrototype(s).catalog.categories.map(c => c.id)).includes(ride.terms.service?.id ?? 'standard'))
    .map(({ p, driver }) => ({ driver, distance: p.location ? Math.round(haversineMeters(p.location, pickup)) : 800 }))
    .sort((a, b) => a.distance - b.distance || a.driver.id.localeCompare(b.driver.id));
  const best = candidates[0];
  if (!best) return null;
  const city = mustFind(s.cities, (c) => c.id === ride.cityId);
  const split = splitFare(ride.terms.breakdown.total, ride.terms.commissionBp);
  const offer: DriverOffer = {
    service: ride.terms.service,
    id: nextId(s, 'OF', 5),
    rideId: ride.id,
    driverId: best.driver.id,
    status: 'pending',
    createdAt: now,
    expiresAt: new Date(nowMs + city.rules.offerTimeoutSeconds * 1000).toISOString(),
    respondedAt: null,
    declineReason: null,
    fare: split.gross,
    commission: split.commission,
    estimatedNet: split.net,
    paymentKind: ride.paymentMethod.kind,
    pickupEtaSeconds: Math.max(60, Math.round(best.distance / (20_000 / 3600) / 60) * 60),
    pickupDistanceMeters: Math.max(100, Math.round(best.distance / 100) * 100),
    route: ride.route,
    passenger: ride.passenger,
  };
  s.offers.push(offer);
  tl(ride, now, 'offer.sent', 'system', `Proposition envoyée à ${best.driver.firstName}`);
  return offer;
}

export function dispatchCity(s: State, cityId: string, nowMs: number) {
  for (const ride of s.rides.filter((r) => r.cityId === cityId && r.status === 'searching').sort((a, b) => a.searchStartedAt.localeCompare(b.searchStartedAt))) {
    dispatch(s, ride, nowMs);
  }
}

export function setOnline(ctx: Ctx, driver: User, online: boolean, location: LatLng | null) {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const now = new Date(nowMs).toISOString();
    if (online) {
      const e = driverEligibility(s, driver, now);
      if (!e.eligible) throw new DomainError(e.reasons.some((r) => r.code === 'debt_limit') ? 'DEBT_LIMIT_REACHED' : 'NOT_ELIGIBLE', undefined, { reasons: e.reasons });
    } else if (s.rides.some((r) => r.driverId === driver.id && (r.status === 'driver_assigned' || r.status === 'driver_arrived' || r.status === 'in_progress'))) {
      throw new DomainError('ACTIVE_RIDE_EXISTS', 'Terminez la course en cours avant de passer hors ligne.');
    }
    let p = s.presence.find((x) => x.driverId === driver.id);
    if (!p) {
      p = { driverId: driver.id, online, location: null, locationAt: null, locationSource: 'demo', bot: false, updatedAt: now };
      s.presence.push(p);
    }
    p.online = online;
    p.updatedAt = now;
    if (location) {
      p.location = location;
      p.locationAt = now;
      p.locationSource = 'gps';
    }
    if (!online) {
      for (const o of s.offers.filter((x) => x.driverId === driver.id && x.status === 'pending')) {
        o.status = offerMachine.next(o.status, 'DECLINE');
        o.respondedAt = now;
        o.declineReason = 'Passée hors ligne';
        const ride = s.rides.find((r) => r.id === o.rideId);
        if (ride) dispatch(s, ride, nowMs);
      }
    } else {
      dispatchCity(s, driver.cityId, nowMs);
    }
    return p;
  });
}

export function updateLocation(ctx: Ctx, driver: User, location: LatLng) {
  return ctx.store.tx((s) => {
    const p = s.presence.find((x) => x.driverId === driver.id);
    if (!p) throw new DomainError('INVALID_TRANSITION', 'Passez en ligne pour partager votre position.');
    p.location = location;
    p.locationAt = ctx.clock.iso();
    p.locationSource = 'gps';
    return { ok: true };
  });
}

/* ───────────── Offers ───────────── */

export function acceptOffer(ctx: Ctx, driver: User, offerId: string): { ride: Ride } {
  const nowMs = ctx.clock.now();
  // Expiry is decided against the authoritative deadline. If the deadline has passed we
  // commit the expiry (and re-dispatch) before refusing, so the state stays consistent.
  const expired = ctx.store.tx((s) => {
    const offer = mustFind(s.offers, (o) => o.id === offerId && o.driverId === driver.id, 'proposition');
    if (offer.status === 'pending' && nowMs >= Date.parse(offer.expiresAt)) {
      expireOffer(s, offer, nowMs);
      return true;
    }
    return false;
  });
  if (expired) throw new DomainError('OFFER_EXPIRED');
  return ctx.store.tx((s) => {
    const offer = mustFind(s.offers, (o) => o.id === offerId && o.driverId === driver.id, 'proposition');
    assertOfferAcceptable(offer, nowMs);
    const ride = mustFind(s.rides, (r) => r.id === offer.rideId, 'course');
    if (ride.status !== 'searching' || ride.driverId) throw new DomainError('RIDE_ALREADY_ASSIGNED');
    const now = new Date(nowMs).toISOString();
    const e = driverEligibility(s, driver, now);
    if (!e.eligible) throw new DomainError('NOT_ELIGIBLE', undefined, { reasons: e.reasons });
    if (!(ensurePrototype(s).driverCategories[driver.id] ?? ensurePrototype(s).catalog.categories.map(c => c.id)).includes(ride.terms.service?.id ?? 'standard')) throw new DomainError('NOT_ELIGIBLE');
    offer.status = offerMachine.next(offer.status, 'ACCEPT');
    offer.respondedAt = now;
    ride.status = rideMachine.next(ride.status, 'ASSIGN');
    ride.driverId = driver.id;
    ride.driver = driverSummary(s, driver);
    ride.assignedAt = now;
    tl(ride, now, 'assigned', 'driver', `${driver.firstName} a accepté la course`);
    for (const other of s.offers.filter((o) => o.rideId === ride.id && o.status === 'pending' && o.id !== offer.id)) {
      other.status = 'withdrawn';
      other.respondedAt = now;
    }
    return { ride };
  });
}

export function declineOffer(ctx: Ctx, driver: User, offerId: string, reasonCode: string) {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const offer = mustFind(s.offers, (o) => o.id === offerId && o.driverId === driver.id, 'proposition');
    if (offer.status !== 'pending') throw new DomainError('OFFER_NOT_PENDING');
    const now = new Date(nowMs).toISOString();
    offer.status = offerMachine.next(offer.status, 'DECLINE');
    offer.respondedAt = now;
    offer.declineReason = reasonLabel(OFFER_DECLINE_REASONS, reasonCode);
    const ride = s.rides.find((r) => r.id === offer.rideId);
    if (ride) {
      tl(ride, now, 'offer.declined', 'driver', `${driver.firstName} a refusé la proposition`);
      dispatch(s, ride, nowMs);
    }
    return offer;
  });
}

function expireOffer(s: State, offer: DriverOffer, nowMs: number) {
  const now = new Date(nowMs).toISOString();
  offer.status = offerMachine.next(offer.status, 'EXPIRE');
  offer.respondedAt = now;
  const ride = s.rides.find((r) => r.id === offer.rideId);
  if (ride) {
    tl(ride, now, 'offer.expired', 'system', 'Proposition expirée sans réponse');
    dispatch(s, ride, nowMs);
  }
}

export function currentOfferFor(s: State, driverId: string) {
  return s.offers.filter((o) => o.driverId === driverId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/* ───────────── Passenger actions ───────────── */

function ownRide(s: State, user: User, rideId: string) {
  const ride = mustFind(s.rides, (r) => r.id === rideId, 'course');
  if (ride.passengerId !== user.id) throw new DomainError('FORBIDDEN');
  return ride;
}

function assignedRide(s: State, driver: User, rideId: string) {
  const ride = mustFind(s.rides, (r) => r.id === rideId, 'course');
  if (ride.driverId !== driver.id) throw new DomainError('FORBIDDEN');
  return ride;
}

export function cancellationPreview(ctx: Ctx, user: User, rideId: string) {
  const s = ctx.store.state;
  const ride = ownRide(s, user, rideId);
  return passengerCancellationPreview(ride, ride.terms.cancellation, ctx.clock.now());
}

function chargeFee(s: State, ride: Ride, fee: number, now: string, ctx: Ctx) {
  if (fee <= 0) return;
  const pm = s.paymentMethods.find((p) => p.id === ride.paymentMethod.id);
  const payment = {
    id: nextId(s, 'PY'),
    rideId: ride.id,
    payerId: ride.passengerId,
    purpose: 'cancellation_fee' as const,
    method: ride.paymentMethod.kind,
    amount: fee,
    status: 'pending' as const,
    provider: ride.paymentMethod.kind === 'card' ? 'demo-card' : 'cash',
    providerRef: ride.paymentMethod.kind === 'card' ? `demo_py_${ride.id}_fee` : null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  };
  s.payments.push(payment);
  if (ride.paymentMethod.kind === 'wallet' || ride.paymentMethod.kind === 'mobile_wallet') {
    if (ride.paymentMethod.kind === 'wallet') settlePassengerWallet(s, ride.passengerId, `${ride.id}-fee`, fee, now);
    Object.assign(payment, { status: 'confirmed', provider: 'wallet-demo' });
    if (ride.driverId) postLedger(s, now, { driverId: ride.driverId, type: 'cancellation_fee_credit', amount: splitFare(fee, ride.terms.commissionBp).net, description: 'Frais d’annulation (portefeuille)', rideId: ride.id, idempotencyKey: `ride:${ride.id}:cancel-fee` });
  } else if (payment.providerRef) queueCardOutcome(s, ctx, payment.providerRef, pm?.providerToken ?? null);
}

export function passengerCancel(ctx: Ctx, user: User, rideId: string, input: CancelInput) {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const now = new Date(nowMs).toISOString();
    const ride = ownRide(s, user, rideId);
    const preview = passengerCancellationPreview(ride, ride.terms.cancellation, nowMs);
    if (preview.reason === 'not_cancellable') throw new DomainError('INVALID_TRANSITION', 'Cette course ne peut plus être annulée.');
    if (preview.fee > 0 && input.acknowledgedFee === undefined) {
      throw new DomainError('VALIDATION', 'Les frais d’annulation doivent être affichés avant confirmation.', { fee: preview.fee });
    }
    if (input.acknowledgedFee !== undefined && input.acknowledgedFee !== preview.fee) {
      throw new DomainError('CONFLICT', `Les frais d’annulation sont maintenant de ${formatMoney(preview.fee)}.`, { fee: preview.fee });
    }
    ride.status = rideMachine.next(ride.status, 'PASSENGER_CANCEL');
    ride.cancellation = { by: 'passenger', reasonCode: input.reasonCode, reasonText: reasonLabel(PASSENGER_CANCEL_REASONS, input.reasonCode, input.reasonText), fee: preview.fee, at: now };
    tl(ride, now, 'cancelled', 'passenger', preview.fee > 0 ? `Annulée par la passagère · frais ${formatMoney(preview.fee)}` : 'Annulée par la passagère · sans frais');
    for (const o of s.offers.filter((x) => x.rideId === ride.id && x.status === 'pending')) {
      o.status = offerMachine.next(o.status, 'WITHDRAW');
      o.respondedAt = now;
    }
    if (ride.paymentMethod.kind === 'wallet') releasePassengerWallet(s, user.id, ride.id);
    chargeFee(s, ride, preview.fee, now, ctx);
    return ride;
  });
}

export function retrySearch(ctx: Ctx, user: User, rideId: string) {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const ride = ownRide(s, user, rideId);
    ride.status = rideMachine.next(ride.status, 'RETRY_SEARCH');
    if (ride.paymentMethod.kind === 'wallet') reservePassengerWallet(s, user.id, ride.id, ride.terms.breakdown.total, new Date(nowMs).toISOString());
    ride.searchStartedAt = new Date(nowMs).toISOString();
    tl(ride, ride.searchStartedAt, 'search.retry', 'passenger', 'Nouvelle recherche lancée');
    dispatch(s, ride, nowMs);
    return ride;
  });
}

export function rateRide(ctx: Ctx, user: User, rideId: string, stars: number, comment: string | null) {
  return ctx.store.tx((s) => {
    const ride = ownRide(s, user, rideId);
    if (ride.status !== 'completed') throw new DomainError('INVALID_TRANSITION', 'Vous pourrez noter la course une fois terminée.');
    if (ride.rating) throw new DomainError('CONFLICT', 'Cette course a déjà été notée.');
    const now = ctx.clock.iso();
    ride.rating = { stars, comment, at: now };
    const driver = s.users.find((u) => u.id === ride.driverId);
    if (driver) {
      const total = (driver.ratingAverage ?? 0) * driver.ratingCount + stars;
      driver.ratingCount += 1;
      driver.ratingAverage = Math.round((total / driver.ratingCount) * 10) / 10;
    }
    return ride;
  });
}

/** Card outcomes in the demo depend on the tokenised test card, like provider sandboxes. */
function queueCardOutcome(s: State, ctx: Ctx, ref: string, token: string | null) {
  const due = new Date(ctx.clock.now() + ctx.config.providerDelaySeconds.payment * 1000).toISOString();
  if (token?.endsWith('0002')) queueProviderJob(s, { kind: 'payment', ref, outcome: 'failed', reason: 'Carte refusée par la banque émettrice.', dueAt: due });
  else if (token?.endsWith('3155')) queueProviderJob(s, { kind: 'payment', ref, outcome: 'manual', reason: null, dueAt: null });
  else queueProviderJob(s, { kind: 'payment', ref, outcome: 'confirmed', reason: null, dueAt: due });
}

export function retryPayment(ctx: Ctx, user: User, rideId: string, paymentMethodId: string) {
  return ctx.store.tx((s) => {
    const ride = ownRide(s, user, rideId);
    const current = s.payments.find((p) => p.id === ride.paymentId);
    if (!current || current.status !== 'failed') throw new DomainError('INVALID_TRANSITION', 'Aucun paiement à relancer.');
    prototypeMethods(s, user);
  const pm = mustFind(s.paymentMethods, (p) => p.id === paymentMethodId && p.userId === user.id, 'moyen de paiement');
    if (pm.kind !== 'card') throw new DomainError('PAYMENT_METHOD_UNAVAILABLE', 'Choisissez une carte pour régler cette course.');
    const now = ctx.clock.iso();
    const id = nextId(s, 'PY');
    const payment = { ...current, id, method: 'card' as const, status: 'pending' as const, provider: 'demo-card', providerRef: `demo_py_${id}`, failureReason: null, createdAt: now, updatedAt: now };
    s.payments.push(payment);
    ride.paymentId = id;
    ride.paymentMethod = { id: pm.id, kind: pm.kind, label: pm.label };
    tl(ride, now, 'payment.retry', 'passenger', `Nouveau paiement avec ${pm.label}`);
    queueCardOutcome(s, ctx, payment.providerRef, pm.providerToken);
    return ride;
  });
}

/* ───────────── Driver ride actions ───────────── */

export function driverArrive(ctx: Ctx, driver: User, rideId: string) {
  return ctx.store.tx((s) => {
    const ride = assignedRide(s, driver, rideId);
    const now = ctx.clock.iso();
    ride.status = rideMachine.next(ride.status, 'ARRIVE');
    ride.arrivedAt = now;
    tl(ride, now, 'arrived', 'driver', `${driver.firstName} est arrivée au point de départ`);
    return ride;
  });
}

export function driverStart(ctx: Ctx, driver: User, rideId: string) {
  return ctx.store.tx((s) => {
    const ride = assignedRide(s, driver, rideId);
    const now = ctx.clock.iso();
    ride.status = rideMachine.next(ride.status, 'START');
    ride.startedAt = now;
    tl(ride, now, 'started', 'driver', 'Trajet commencé');
    return ride;
  });
}

export function driverCompleteStop(ctx: Ctx, driver: User, rideId: string) {
  return ctx.store.tx((s) => {
    const ride = assignedRide(s, driver, rideId);
    if (ride.status !== 'in_progress') throw new DomainError('INVALID_TRANSITION');
    const intermediate = ride.route.stops.length - 2;
    if (ride.completedStops >= intermediate) throw new DomainError('INVALID_TRANSITION', 'Aucun arrêt restant.');
    const stop = ride.route.stops[ride.completedStops + 1]!;
    ride.completedStops += 1;
    tl(ride, ctx.clock.iso(), 'stop.done', 'driver', `Arrêt effectué · ${stop.label}`);
    return ride;
  });
}

export function driverComplete(ctx: Ctx, driver: User, rideId: string) {
  return ctx.store.tx((s) => {
    const ride = assignedRide(s, driver, rideId);
    const intermediate = ride.route.stops.length - 2;
    if (ride.status === 'in_progress' && ride.completedStops < intermediate) {
      throw new DomainError('INVALID_TRANSITION', 'Confirmez d’abord l’arrêt intermédiaire.');
    }
    const now = ctx.clock.iso();
    ride.status = rideMachine.next(ride.status, 'COMPLETE');
    ride.completedAt = now;
    tl(ride, now, 'completed', 'driver', 'Arrivée à destination');
    settleRide(s, ctx, ride, now);
    return ride;
  });
}

/**
 * Completion creates the payment. Cash: the commission is owed now and debited once.
 * Card: nothing is credited until the provider confirms the payment.
 */
function settleRide(s: State, ctx: Ctx, ride: Ride, now: string) {
  const split = splitFare(ride.terms.breakdown.total, ride.terms.commissionBp);
  const pm = s.paymentMethods.find((p) => p.id === ride.paymentMethod.id);
  const id = nextId(s, 'PY');
  const isCard = ride.paymentMethod.kind === 'card';
  s.payments.push({
    id,
    rideId: ride.id,
    payerId: ride.passengerId,
    purpose: 'ride',
    method: ride.paymentMethod.kind,
    amount: split.gross,
    status: 'pending',
    provider: isCard ? 'demo-card' : 'cash',
    providerRef: isCard ? `demo_py_${id}` : null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  });
  ride.paymentId = id;
  if (ride.paymentMethod.kind === 'wallet' || ride.paymentMethod.kind === 'mobile_wallet') {
    if (ride.paymentMethod.kind === 'wallet') settlePassengerWallet(s, ride.passengerId, ride.id, split.gross, now);
    const p = s.payments.find(p => p.id === id)!; p.status = 'confirmed'; p.provider = ride.paymentMethod.kind === 'wallet' ? 'naya-wallet-demo' : 'mobile-wallet-demo';
    postLedger(s, now, { driverId: ride.driverId!, type: 'ride_net_credit', amount: split.net, description: `Revenu net ${ride.paymentMethod.label}`, rideId: ride.id, idempotencyKey: `ride:${ride.id}:net` });
    tl(ride, now, 'payment.confirmed', 'provider', 'Paiement portefeuille confirmé (simulation)');
    return;
  }
  if (isCard) {
    queueCardOutcome(s, ctx, `demo_py_${id}`, pm?.providerToken ?? null);
  } else {
    const draft = rideSettlement('cash', split, ride.id);
    postLedger(s, now, { driverId: ride.driverId!, ...draft, rideId: ride.id, idempotencyKey: `ride:${ride.id}:commission` });
  }
}

export function confirmCashCollected(ctx: Ctx, driver: User, rideId: string, amount: number) {
  return ctx.store.tx((s) => {
    const ride = assignedRide(s, driver, rideId);
    const p = mustFind(s.payments, (x) => x.id === ride.paymentId, 'paiement');
    if (p.method !== 'cash') throw new DomainError('INVALID_TRANSITION', 'Cette course est payée par carte.');
    if (p.status === 'confirmed') return ride;
    if (amount !== p.amount) throw new DomainError('VALIDATION', `Montant attendu : ${formatMoney(p.amount)}.`);
    const now = ctx.clock.iso();
    p.status = 'confirmed';
    p.updatedAt = now;
    tl(ride, now, 'cash.collected', 'driver', `Espèces encaissées · ${formatMoney(amount)}`);
    return ride;
  });
}

export function driverCancel(ctx: Ctx, driver: User, rideId: string, reasonCode: string, reasonText?: string) {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const now = new Date(nowMs).toISOString();
    const ride = assignedRide(s, driver, rideId);
    ride.status = rideMachine.next(ride.status, 'DRIVER_CANCEL');
    const label = reasonLabel(DRIVER_CANCEL_REASONS, reasonCode, reasonText);
    ride.driverCancellations.push({ driverId: driver.id, reasonCode, reasonText: label, at: now });
    ride.driverId = null;
    ride.driver = null;
    ride.assignedAt = null;
    ride.arrivedAt = null;
    ride.searchStartedAt = now;
    tl(ride, now, 'driver.cancelled', 'driver', `${driver.firstName} a annulé · ${label}`);
    tl(ride, now, 'search.restart', 'system', 'Recherche d’une autre chauffeuse');
    appendAudit(s, now, { actor: { type: 'user', id: driver.id, name: `${driver.firstName} ${driver.lastName}` }, action: 'ride.driver_cancelled', entityType: 'ride', entityId: ride.id, cityId: ride.cityId, reason: label, summary: `Annulation chauffeuse sur ${ride.id}, nouvelle recherche lancée` });
    dispatch(s, ride, nowMs);
    return ride;
  });
}

/* ───────────── Tracking (read model) ───────────── */

function offsetPoint(p: LatLng, meters: number): LatLng {
  // Deterministic approach point north-east of the pickup.
  const d = meters / 111_320;
  return { lat: p.lat + d * 0.7, lng: p.lng + d * 0.7 };
}

export function withTracking(s: State, ride: Ride, nowMs: number): Ride {
  if (!ride.driverId || !['driver_assigned', 'driver_arrived', 'in_progress'].includes(ride.status)) return { ...ride, driverLocation: null };
  const frozen = s.tracking.find((t) => t.rideId === ride.id);
  const presence = s.presence.find((p) => p.driverId === ride.driverId);
  const pickup = ride.route.stops[0]!.location;
  const evalAt = frozen ? Date.parse(frozen.frozenAt) : nowMs;
  let location: LatLng;
  let at = new Date(evalAt).toISOString();
  let source: 'demo' | 'gps' = 'demo';
  if (presence?.locationSource === 'gps' && presence.location && presence.locationAt && !presence.bot) {
    location = presence.location;
    at = presence.locationAt;
    source = 'gps';
  } else if (ride.status === 'driver_assigned') {
    const offer = s.offers.find((o) => o.rideId === ride.id && o.status === 'accepted' && o.driverId === ride.driverId);
    const eta = (offer?.pickupEtaSeconds ?? 180) * 1000;
    const start = offsetPoint(pickup, offer?.pickupDistanceMeters ?? 800);
    const t = Math.min(0.97, (evalAt - Date.parse(ride.assignedAt!)) / (eta / DEMO_TIME_FACTOR));
    location = pointAlong([start, pickup], Math.max(0, t));
  } else if (ride.status === 'driver_arrived') {
    location = pickup;
  } else {
    const t = Math.min(0.99, (evalAt - Date.parse(ride.startedAt!)) / ((ride.route.durationSeconds * 1000) / DEMO_TIME_FACTOR));
    location = pointAlong(ride.route.polyline, Math.max(0, t));
  }
  return { ...ride, driverLocation: { location, at, source, stale: nowMs - Date.parse(at) > STALE_AFTER_MS } };
}

/* ───────────── Scheduled bookings ───────────── */

export function scheduleRide(ctx: Ctx, user: User, quoteId: string, paymentMethodId: string, pickupAt: string): ScheduledBooking {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const now = new Date(nowMs).toISOString();
    requireVerifiedPassenger(s, user);
    const quote = mustFind(s.quotes, (q) => q.id === quoteId && q.passengerId === user.id, 'devis');
    const city = mustFind(s.cities, (c) => c.id === quote.cityId);
    assertPickupTimeAllowed(pickupAt, city.rules.scheduling, nowMs);
    const { quote: q } = takeQuote(s, user, quoteId, nowMs);
    const booking: ScheduledBooking = {
      id: nextId(s, 'RP'),
      passengerId: user.id,
      cityId: q.cityId,
      route: q.route,
      terms: freezeTerms(s, q, city, now),
      paymentMethod: paymentRef(s, user, paymentMethodId, city.id),
      pickupAt,
      status: 'scheduled',
      rideId: null,
      createdAt: now,
      updatedAt: now,
      cancellation: null,
      history: [{ at: now, label: 'Réservation enregistrée · aucune chauffeuse assignée pour le moment' }],
    };
    if (booking.paymentMethod.kind === 'wallet') reservePassengerWallet(s, user.id, booking.id, booking.terms.breakdown.total, now);
    s.scheduled.push(booking);
    return booking;
  });
}

function ownBooking(s: State, user: User, id: string) {
  const b = mustFind(s.scheduled, (x) => x.id === id, 'réservation');
  if (b.passengerId !== user.id) throw new DomainError('FORBIDDEN');
  return b;
}

export function modifyScheduled(ctx: Ctx, user: User, id: string, input: ModifyScheduled) {
  return ctx.store.tx((s) => {
    const nowMs = ctx.clock.now();
    const b = ownBooking(s, user, id);
    const city = mustFind(s.cities, (c) => c.id === b.cityId);
    assertModifiable(b, city.rules.scheduling, nowMs);
    assertPickupTimeAllowed(input.pickupAt, city.rules.scheduling, nowMs);
    b.status = scheduledMachine.next(b.status, 'MODIFY');
    const now = new Date(nowMs).toISOString();
    b.pickupAt = input.pickupAt;
    if (input.paymentMethodId) {
      if (b.paymentMethod.kind === 'wallet') releasePassengerWallet(s, user.id, b.id);
      b.paymentMethod = paymentRef(s, user, input.paymentMethodId, city.id);
      if (b.paymentMethod.kind === 'wallet') reservePassengerWallet(s, user.id, b.id, b.terms.breakdown.total, now);
    }
    b.updatedAt = now;
    b.history.push({ at: now, label: 'Horaire modifié · prix inchangé' });
    return b;
  });
}

export function cancelScheduled(ctx: Ctx, user: User, id: string, reasonCode: string, reasonText?: string) {
  return ctx.store.tx((s) => {
    const b = ownBooking(s, user, id);
    b.status = scheduledMachine.next(b.status, 'CANCEL');
    const now = ctx.clock.iso();
    b.cancellation = { reasonCode, reasonText: reasonLabel(PASSENGER_CANCEL_REASONS, reasonCode, reasonText), at: now };
    b.updatedAt = now;
    if (b.paymentMethod.kind === 'wallet') releasePassengerWallet(s, user.id, b.id);
    b.history.push({ at: now, label: 'Réservation annulée · sans frais' });
    return b;
  });
}

/** Dispatch starts 15 minutes before pickup. Only then does the search for a driver begin. */
export const DISPATCH_LEAD_MS = 15 * 60_000;

export function dispatchDueScheduled(s: State, nowMs: number) {
  const now = new Date(nowMs).toISOString();
  for (const b of s.scheduled.filter((x) => x.status === 'scheduled' && Date.parse(x.pickupAt) - DISPATCH_LEAD_MS <= nowMs)) {
    const user = s.users.find((u) => u.id === b.passengerId)!;
    if (s.rides.some((r) => r.passengerId === user.id && isRideActive(r.status))) {
      b.status = scheduledMachine.next(b.status, 'EXPIRE');
      if (b.paymentMethod.kind === 'wallet') releasePassengerWallet(s, user.id, b.id);
      b.history.push({ at: now, label: 'Non lancée : une autre course était en cours' });
      continue;
    }
    const ride = newRide(s, user, b.route, b.terms, b.paymentMethod, now, b.id);
    if (b.paymentMethod.kind === 'wallet') for (const e of passengerWallet(s, user.id).entries.filter(e => e.rideId === b.id && e.status === 'pending')) { e.rideId = ride.id; e.id = `hold:${ride.id}`; }
    s.rides.push(ride);
    b.status = scheduledMachine.next(b.status, 'DISPATCH');
    b.rideId = ride.id;
    b.updatedAt = now;
    b.history.push({ at: now, label: `Recherche d’une chauffeuse lancée · ${ride.id}` });
    dispatch(s, ride, nowMs);
  }
}

/* ───────────── Timers (evaluated against the clock, safe across restarts) ───────────── */

export function runRideTimers(s: State, nowMs: number): boolean {
  let changed = false;
  for (const o of s.offers.filter((x) => x.status === 'pending' && Date.parse(x.expiresAt) <= nowMs)) {
    expireOffer(s, o, nowMs);
    changed = true;
  }
  for (const r of s.rides.filter((x) => x.status === 'searching')) {
    const city = s.cities.find((c) => c.id === r.cityId);
    const pending = s.offers.some((o) => o.rideId === r.id && o.status === 'pending');
    if (city && !pending && nowMs - Date.parse(r.searchStartedAt) >= city.rules.searchTimeoutSeconds * 1000) {
      r.status = rideMachine.next(r.status, 'SEARCH_TIMEOUT');
      if (r.paymentMethod.kind === 'wallet') releasePassengerWallet(s, r.passengerId, r.id);
      tl(r, new Date(nowMs).toISOString(), 'search.timeout', 'system', 'Aucune chauffeuse disponible pour le moment');
      changed = true;
    }
  }
  const before = s.scheduled.filter((b) => b.status === 'scheduled').length;
  dispatchDueScheduled(s, nowMs);
  if (s.scheduled.filter((b) => b.status === 'scheduled').length !== before) changed = true;
  return changed;
}

export function hasDueRideTimers(s: State, nowMs: number) {
  return (
    s.offers.some((x) => x.status === 'pending' && Date.parse(x.expiresAt) <= nowMs) ||
    s.rides.some((r) => {
      if (r.status !== 'searching') return false;
      const city = s.cities.find((c) => c.id === r.cityId);
      return !!city && !s.offers.some((o) => o.rideId === r.id && o.status === 'pending') && nowMs - Date.parse(r.searchStartedAt) >= city.rules.searchTimeoutSeconds * 1000;
    }) ||
    s.scheduled.some((b) => b.status === 'scheduled' && Date.parse(b.pickupAt) - DISPATCH_LEAD_MS <= nowMs)
  );
}

export { applyBp };
