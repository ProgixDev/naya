import type { CityId, LatLng, PaymentMethodKind, Place, UserId } from './entities';
import { DomainError } from './errors';
import { mad, type BasisPoints, type Centimes } from './money';
import { splitFare } from './pricing';
import { casablancaLocalToUtc, toCasablancaParts, type IsoUtc } from './time';

/**
 * « Lavage à domicile »: a team comes to where the car is parked and washes it.
 * Passengers order it for their own car, drivers for their Naya car.
 *
 * Everything in CAR_WASH_DEMO_CONFIG is a PLACEHOLDER chosen for the demo. The client
 * sets the real packages, prices, durations, hours, commission and cancellation fees.
 * The server prices every order from this configuration and freezes the terms at booking.
 */

/* ───────────── Configuration ───────────── */

export type WashPackageId = 'exterior' | 'interior_exterior' | 'complete';

export interface WashPackage {
  id: WashPackageId;
  name: string;
  description: string;
  includes: string[];
  /** Real time the team spends on the car. */
  durationMinutes: number;
  price: Centimes;
  enabled: boolean;
}

export interface WashCancellationPolicy {
  /** Free cancellation during this many seconds after a team is assigned. */
  graceSeconds: number;
  /** Free cancellation while the planned start is at least this far away. */
  freeUntilMinutesBefore: number;
  /** Fee once a team is assigned and both free windows are over. */
  lateFee: Centimes;
  /** Fee once the team is on its way. */
  enRouteFee: Centimes;
}

export interface WashScheduling {
  /** Casablanca wall-clock opening and closing ("08:00", "20:00"). A wash must end by closing. */
  openingTime: string;
  closingTime: string;
  slotMinutes: number;
  minLeadMinutes: number;
  maxDaysAhead: number;
}

export interface CarWashCityRules {
  cityId: CityId;
  enabled: boolean;
  /** Bumped whenever the client changes the rules; frozen into each order. */
  version: number;
  packages: WashPackage[];
  /** Naya's share of each wash, kept for the partner settlement (placeholder). */
  commissionBp: BasisPoints;
  scheduling: WashScheduling;
  /** Arrival estimate shown for « Maintenant ». */
  nowEtaMinutes: number;
  cancellation: WashCancellationPolicy;
  /** Orders booked, assigned, en route or washing at the same time, per customer. */
  maxOpenOrders: number;
}

/** How the demo engine plays the washing team. Never used outside demo mode. */
export interface CarWashDemoEngine {
  assignAfterSeconds: number;
  /** « Maintenant »: the team leaves this long after assignment. */
  departAfterAssignSeconds: number;
  /** Simulated travel time (real seconds). A scheduled team leaves this long before the slot. */
  travelSeconds: number;
  /** Washing plays this many times faster than real time. */
  timeFactor: number;
  /** Distance (m) of the team's starting point from the car. */
  startDistanceMeters: number;
}

export interface WashTeam {
  id: string;
  name: string;
  cityId: CityId;
  ratingAverage: number;
  vehicleLabel: string;
}

const PACKAGES = (prices: Record<WashPackageId, number>): WashPackage[] => [
  {
    id: 'exterior',
    name: 'Extérieur',
    description: 'Carrosserie, jantes et vitres',
    includes: ['Lavage de la carrosserie', 'Jantes et pneus', 'Vitres extérieures', 'Séchage à la microfibre'],
    durationMinutes: 45,
    price: mad(prices.exterior),
    enabled: true,
  },
  {
    id: 'interior_exterior',
    name: 'Intérieur + extérieur',
    description: 'L’extérieur, plus l’habitacle aspiré',
    includes: ['Tout l’extérieur', 'Aspiration des sièges et des tapis', 'Tableau de bord et portières', 'Vitres intérieures'],
    durationMinutes: 75,
    price: mad(prices.interior_exterior),
    enabled: true,
  },
  {
    id: 'complete',
    name: 'Complet',
    description: 'Le soin le plus poussé, dedans et dehors',
    includes: ['Intérieur + extérieur', 'Shampoing des sièges', 'Coffre', 'Lustrage de la carrosserie'],
    durationMinutes: 120,
    price: mad(prices.complete),
    enabled: true,
  },
];

const SCHEDULING: WashScheduling = { openingTime: '08:00', closingTime: '20:00', slotMinutes: 30, minLeadMinutes: 60, maxDaysAhead: 7 };
const CANCELLATION: WashCancellationPolicy = { graceSeconds: 300, freeUntilMinutesBefore: 120, lateFee: mad(20), enRouteFee: mad(30) };

/**
 * Demo configuration of the car-wash service, per city. PLACEHOLDER VALUES: the client
 * will set the real prices, durations and rules. Cities without an entry do not offer it.
 */
export const CAR_WASH_DEMO_CONFIG: {
  placeholder: true;
  cities: Record<CityId, CarWashCityRules>;
  engine: CarWashDemoEngine;
  teams: WashTeam[];
} = {
  placeholder: true,
  cities: {
    rabat: {
      cityId: 'rabat',
      enabled: true,
      version: 1,
      packages: PACKAGES({ exterior: 60, interior_exterior: 110, complete: 180 }),
      commissionBp: 2000,
      scheduling: SCHEDULING,
      nowEtaMinutes: 40,
      cancellation: CANCELLATION,
      maxOpenOrders: 3,
    },
    casablanca: {
      cityId: 'casablanca',
      enabled: true,
      version: 1,
      packages: PACKAGES({ exterior: 70, interior_exterior: 125, complete: 200 }),
      commissionBp: 2000,
      scheduling: SCHEDULING,
      nowEtaMinutes: 45,
      cancellation: CANCELLATION,
      maxOpenOrders: 3,
    },
  },
  engine: { assignAfterSeconds: 15, departAfterAssignSeconds: 10, travelSeconds: 60, timeFactor: 20, startDistanceMeters: 2200 },
  teams: [
    { id: 'WT-RBA-1', name: 'Équipe Lavage Agdal', cityId: 'rabat', ratingAverage: 4.9, vehicleLabel: 'Triporteur de lavage' },
    { id: 'WT-RBA-2', name: 'Équipe Lavage Hay Riad', cityId: 'rabat', ratingAverage: 4.8, vehicleLabel: 'Triporteur de lavage' },
    { id: 'WT-CAS-1', name: 'Équipe Lavage Maârif', cityId: 'casablanca', ratingAverage: 4.8, vehicleLabel: 'Triporteur de lavage' },
  ],
};

export function carWashRulesFor(cityId: CityId): CarWashCityRules | null {
  const rules = CAR_WASH_DEMO_CONFIG.cities[cityId];
  return rules && rules.enabled ? rules : null;
}

/* ───────────── Orders ───────────── */

export type WashOrderStatus = 'booked' | 'washer_assigned' | 'en_route' | 'washing' | 'completed' | 'cancelled';
export type WashTiming = 'now' | 'scheduled';
/** Passengers pay with their saved methods; drivers from their Naya wallet or in cash. */
export type WashPaymentKind = PaymentMethodKind | 'driver_wallet';

export interface WashPaymentRef {
  id: string;
  kind: WashPaymentKind;
  label: string;
}

export interface WashPaymentOption extends WashPaymentRef {
  available: boolean;
  note: string | null;
  isDefault: boolean;
}

export interface WashCar {
  make: string;
  model: string;
  color: string;
  plate: string;
}

/** Commercial terms frozen at booking. Later configuration changes never alter them. */
export interface WashTerms {
  cityId: CityId;
  rulesVersion: number;
  packageId: WashPackageId;
  packageName: string;
  includes: string[];
  durationMinutes: number;
  price: Centimes;
  commissionBp: BasisPoints;
  cancellation: WashCancellationPolicy;
  currency: 'MAD';
  acceptedAt: IsoUtc;
}

export interface WashTeamSummary {
  id: string;
  name: string;
  ratingAverage: number;
  vehicleLabel: string;
  phoneMasked: string;
}

export interface WashPhoto {
  id: string;
  stage: 'before' | 'after';
  /** Upload taken by the team. Null for the simulated demo photos. */
  uploadId: string | null;
  label: string;
  at: IsoUtc;
}

export interface WashCancellation {
  by: 'customer' | 'system';
  reasonCode: string;
  reasonText: string;
  fee: Centimes;
  at: IsoUtc;
}

export interface WashTeamLocation {
  location: LatLng;
  at: IsoUtc;
  source: 'demo' | 'gps';
  /** Minutes until arrival, while en route. */
  etaMinutes: number | null;
}

export interface WashOrder {
  id: string;
  cityId: CityId;
  customerId: UserId;
  customerRole: 'passenger' | 'driver';
  customerFirstName: string;
  location: Place;
  parkingNotes: string;
  car: WashCar;
  /** Driver orders: the Naya vehicle the car was prefilled from, if any. */
  vehicleId: string | null;
  terms: WashTerms;
  timing: WashTiming;
  /** Planned start and end of the wash. For « Maintenant », an estimate. */
  startAt: IsoUtc;
  endAt: IsoUtc;
  paymentMethod: WashPaymentRef;
  paymentId: string | null;
  status: WashOrderStatus;
  team: WashTeamSummary | null;
  /** Where the simulated team starts from. */
  teamBase: LatLng | null;
  /** Read model, computed by the server while the team is on its way or washing. */
  teamLocation: WashTeamLocation | null;
  photos: WashPhoto[];
  createdAt: IsoUtc;
  assignedAt: IsoUtc | null;
  departedAt: IsoUtc | null;
  startedAt: IsoUtc | null;
  completedAt: IsoUtc | null;
  cancellation: WashCancellation | null;
  rating: { stars: number; comment: string | null; at: IsoUtc } | null;
  timeline: { at: IsoUtc; type: string; label: string }[];
  /** Demo marker: the team, its movement and its photos are simulated. */
  simulated: boolean;
}

export const WASH_STATUS_LABELS: Record<WashOrderStatus, string> = {
  booked: 'Réservé',
  washer_assigned: 'Équipe de lavage assignée',
  en_route: 'Équipe en route',
  washing: 'Lavage en cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

/** The five steps of the tracking timeline, in order. */
export const WASH_PROGRESS: readonly Exclude<WashOrderStatus, 'cancelled'>[] = ['booked', 'washer_assigned', 'en_route', 'washing', 'completed'];

export const WASH_CANCEL_REASONS = [
  { code: 'changed_plans', label: 'Mes plans ont changé' },
  { code: 'car_moved', label: 'La voiture n’est plus à cet endroit' },
  { code: 'wrong_time', label: 'Le créneau ne me convient plus' },
  { code: 'wait_too_long', label: 'L’attente est trop longue' },
  { code: 'other', label: 'Autre raison' },
] as const;

export const WASH_PAYMENT_LABELS: Record<WashPaymentKind, string> = {
  cash: 'Espèces',
  card: 'Carte',
  wallet: 'Portefeuille Naya',
  mobile_wallet: 'Wallet marocain',
  driver_wallet: 'Portefeuille chauffeuse',
};

/* ───────────── Pricing ───────────── */

export interface WashPrice {
  package: WashPackage;
  price: Centimes;
  durationMinutes: number;
  commission: Centimes;
  partnerNet: Centimes;
}

/** Server-side price of a package under the given rules. Throws when it is not offered. */
export function priceWash(rules: CarWashCityRules, packageId: WashPackageId): WashPrice {
  const pkg = rules.packages.find((p) => p.id === packageId && p.enabled);
  if (!pkg) throw new DomainError('NOT_FOUND', 'Formule de lavage indisponible.');
  const split = splitFare(pkg.price, rules.commissionBp);
  return { package: pkg, price: pkg.price, durationMinutes: pkg.durationMinutes, commission: split.commission, partnerNet: split.net };
}

export function washEndAt(startIso: IsoUtc, durationMinutes: number): IsoUtc {
  return new Date(Date.parse(startIso) + durationMinutes * 60_000).toISOString();
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};
const toHhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Casablanca-local start times ("HH:MM") on `date` that fit the opening hours, the lead time and the horizon. */
export function washSlots(scheduling: WashScheduling, durationMinutes: number, date: string, nowMs: number): string[] {
  const out: string[] = [];
  const last = minutesOf(scheduling.closingTime) - durationMinutes;
  for (let m = minutesOf(scheduling.openingTime); m <= last; m += scheduling.slotMinutes) {
    const t = toHhmm(m);
    const at = Date.parse(casablancaLocalToUtc(date, t));
    if (at >= nowMs + scheduling.minLeadMinutes * 60_000 && at <= nowMs + scheduling.maxDaysAhead * 86_400_000) out.push(t);
  }
  return out;
}

/** Refuses a scheduled start that is not one of the slots the screen offers. */
export function assertWashStartAllowed(startIso: IsoUtc, scheduling: WashScheduling, durationMinutes: number, nowMs: number) {
  const at = Date.parse(startIso);
  if (Number.isNaN(at)) throw new DomainError('VALIDATION', 'Créneau invalide.');
  if (at < nowMs + scheduling.minLeadMinutes * 60_000) {
    throw new DomainError('SCHEDULE_TOO_SOON', `Réservez au moins ${scheduling.minLeadMinutes} minutes à l’avance, ou choisissez « Maintenant ».`);
  }
  if (at > nowMs + scheduling.maxDaysAhead * 86_400_000) {
    throw new DomainError('SCHEDULE_TOO_FAR', `Réservez au plus ${scheduling.maxDaysAhead} jours à l’avance.`);
  }
  const m = minutesOf(toCasablancaParts(startIso).time);
  const open = minutesOf(scheduling.openingTime);
  if (m < open || m + durationMinutes > minutesOf(scheduling.closingTime) || (m - open) % scheduling.slotMinutes !== 0) {
    throw new DomainError('VALIDATION', `Choisissez un créneau proposé, entre ${scheduling.openingTime.replace(':', 'h')} et ${scheduling.closingTime.replace(':', 'h')}.`);
  }
}

/* ───────────── Cancellation ───────────── */

export type WashCancellationReason = 'before_assignment' | 'within_grace' | 'before_cutoff' | 'late' | 'en_route' | 'not_cancellable';

export interface WashCancellationPreview {
  fee: Centimes;
  reason: WashCancellationReason;
  /** When the free window ends (ISO), if one is running. */
  freeUntil: IsoUtc | null;
  explanation: string;
}

/** Fee the customer would pay if she cancelled now, from the order's frozen policy. Never above the price. */
export function washCancellationPreview(
  order: Pick<WashOrder, 'status' | 'assignedAt' | 'startAt'> & { terms: Pick<WashTerms, 'cancellation' | 'price'> },
  nowMs: number,
): WashCancellationPreview {
  const policy = order.terms.cancellation;
  const cap = (fee: Centimes) => Math.min(fee, order.terms.price);
  switch (order.status) {
    case 'booked':
      return { fee: 0, reason: 'before_assignment', freeUntil: null, explanation: 'Aucune équipe n’est encore assignée : l’annulation est gratuite.' };
    case 'washer_assigned': {
      const graceEnd = Date.parse(order.assignedAt ?? new Date(nowMs).toISOString()) + policy.graceSeconds * 1000;
      const cutoff = Date.parse(order.startAt) - policy.freeUntilMinutesBefore * 60_000;
      const freeUntilMs = Math.max(graceEnd, cutoff);
      if (nowMs < freeUntilMs) {
        const beforeCutoff = nowMs < cutoff;
        return {
          fee: 0,
          reason: beforeCutoff ? 'before_cutoff' : 'within_grace',
          freeUntil: new Date(freeUntilMs).toISOString(),
          explanation: beforeCutoff
            ? `Annulation gratuite jusqu’à ${Math.round(policy.freeUntilMinutesBefore / 60)} h avant le créneau.`
            : `Annulation gratuite pendant ${Math.round(policy.graceSeconds / 60)} minutes après l’attribution de l’équipe.`,
        };
      }
      return { fee: cap(policy.lateFee), reason: 'late', freeUntil: null, explanation: 'L’équipe de lavage s’organise déjà pour votre créneau.' };
    }
    case 'en_route':
      return { fee: cap(policy.enRouteFee), reason: 'en_route', freeUntil: null, explanation: 'L’équipe de lavage est déjà en route vers votre voiture.' };
    default:
      return { fee: 0, reason: 'not_cancellable', freeUntil: null, explanation: 'Ce lavage ne peut plus être annulé.' };
  }
}
