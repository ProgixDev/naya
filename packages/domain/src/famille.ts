import { z } from 'zod';
import type { LatLng, Place, User } from './entities';
import { DomainError } from './errors';
import { demoRoute, haversineMeters, pointAlong } from './geo';
import { familyTripMachine, type FamilyTripEvent } from './machines/family';
import { HANDOVER_MAX_ATTEMPTS, type FamilyApprovalMode, type FamilyChild, type FamilyLive, type FamilyStartApproval, type FamilyTrip, type FamilyTripStatus } from './prototype';

/* ───────────── Driver eligibility for Naya Famille ───────────── */

/**
 * Stricter vetting for Famille chauffeuses (criminal-record extract, references, interview…).
 * The review flow itself lands on branch `feat/driver-signup`; this branch only reads the flag.
 * Contract: `User.familleEligibility`, driver accounts only, absent = `not_requested`.
 */
export const FAMILLE_ELIGIBILITY_VALUES = ['not_requested', 'pending', 'approved', 'rejected'] as const;
export type FamilleEligibility = (typeof FAMILLE_ELIGIBILITY_VALUES)[number];
export const FAMILLE_ELIGIBILITY_LABELS: Record<FamilleEligibility, string> = {
  not_requested: 'Non demandée',
  pending: 'En cours d’examen',
  approved: 'Approuvée',
  rejected: 'Refusée',
};

export const familleEligibilityOf = (u: Pick<User, 'role' | 'familleEligibility'>): FamilleEligibility =>
  u.role === 'driver' ? (u.familleEligibility ?? 'not_requested') : 'not_requested';

/** The eligibility gate: only approved chauffeuses can be assigned or run a Famille trip. */
export const canReceiveFamilleTrips = (u: Pick<User, 'role' | 'familleEligibility' | 'status'>) =>
  u.role === 'driver' && u.status === 'active' && familleEligibilityOf(u) === 'approved';

export function assertFamilleEligible(u: Pick<User, 'role' | 'familleEligibility' | 'status'>) {
  if (!canReceiveFamilleTrips(u)) throw new DomainError('FAMILLE_NOT_ELIGIBLE');
}

/* ───────────── Trip rules ───────────── */

/** The parent has this long to answer « Démarrer » before the request expires. */
export const FAMILY_APPROVAL_TIMEOUT_SECONDS = 180;
/** After this many unanswered or refused requests the chauffeuse must call or cancel. */
export const FAMILY_MAX_START_REQUESTS = 3;
/** The drop-off photo must be taken this close to the school. */
export const FAMILY_DROPOFF_RADIUS_METERS = 300;
/** A device position older than this is shown as stale and the demo simulation takes over. */
export const FAMILY_LIVE_STALE_SECONDS = 5;
/** Clients poll the live position at this rate while a trip is active. */
export const FAMILY_LIVE_POLL_MS = 1000;
/** Demo movement runs this many times faster than the route time. */
export const FAMILY_DEMO_TIME_FACTOR = 20;
/** Dev-mode stand-ins for photos when no camera is available. */
export const FAMILY_DEMO_PROOFS = { pickup: 'demo-pickup-photo', dropoff: 'demo-dropoff-photo' } as const;

/** Shown once a trip's handover is locked after HANDOVER_MAX_ATTEMPTS wrong codes. */
export const HANDOVER_LOCKED_MESSAGE = `Remise bloquée après ${HANDOVER_MAX_ATTEMPTS} codes incorrects. Ne confiez pas l’enfant : contactez la famille ou le support Naya.`;

/** « when set »: the handover code is required as soon as the child has a recipient with a code. */
export const requiresHandoverCode = (child: Pick<FamilyChild, 'recipients'>) => child.recipients.some((r) => /^\d{4}$/.test(r.verificationCode));

export interface FamilyStepInput {
  proof?: string | null;
  childName?: string;
  recipientId?: string;
  code?: string;
  approvalId?: string;
  reason?: string;
  mode?: FamilyApprovalMode;
}

export interface FamilyStepContext {
  nowMs: number;
  actor: 'driver' | 'parent' | 'system';
  child: Pick<FamilyChild, 'firstName' | 'recipients'>;
  /** Current position of the chauffeuse (drop-off geofence). */
  position: LatLng | null;
  input: FamilyStepInput;
}

const DRIVER_EVENTS: FamilyTripEvent[] = ['DEPART', 'ARRIVE', 'PICKUP', 'REQUEST_START', 'DROPOFF'];
const PARENT_EVENTS: FamilyTripEvent[] = ['APPROVE', 'REFUSE'];

type GuardTrip = Pick<FamilyTrip, 'status' | 'destination'> & Partial<Pick<FamilyTrip, 'pickupPhoto' | 'approval' | 'approvals' | 'handoverLocked'>>;

/**
 * The single guard for every Famille transition. Returns the next status or throws a
 * DomainError the apps can show as is. The server applies side effects only after this passes.
 */
export function assertFamilyStep(trip: GuardTrip, event: FamilyTripEvent, c: FamilyStepContext): FamilyTripStatus {
  const next = familyTripMachine.next(trip.status, event);
  if (DRIVER_EVENTS.includes(event) && c.actor === 'parent') throw new DomainError('FORBIDDEN', 'Seule la chauffeuse peut faire avancer le trajet.');
  if (PARENT_EVENTS.includes(event) && c.actor !== 'parent') throw new DomainError('FORBIDDEN', 'Seul le parent peut approuver ou refuser le départ.');
  if (event === 'EXPIRE' && c.actor !== 'system') throw new DomainError('FORBIDDEN');
  const approval = trip.approval ?? null;
  switch (event) {
    case 'PICKUP': {
      if (!c.input.proof) throw new DomainError('FAMILY_PROOF_REQUIRED', 'Photographiez l’enfant avant de démarrer.');
      if (c.input.childName?.trim().toLowerCase() !== c.child.firstName.toLowerCase())
        throw new DomainError('VALIDATION', 'Le prénom ne correspond pas. Demandez son prénom à l’enfant avant de confirmer.');
      break;
    }
    case 'REQUEST_START': {
      if (!trip.pickupPhoto) throw new DomainError('FAMILY_PROOF_REQUIRED', 'Photographiez l’enfant avant de démarrer.');
      if ((trip.approvals ?? []).length >= FAMILY_MAX_START_REQUESTS)
        throw new DomainError('FAMILY_APPROVAL_REQUIRED', 'Le parent n’a pas approuvé le départ. Appelez-le ou annulez le trajet.');
      break;
    }
    case 'APPROVE':
    case 'REFUSE': {
      if (!approval || approval.status !== 'pending') throw new DomainError('FAMILY_APPROVAL_REQUIRED', 'Aucune demande de départ en attente.');
      if (c.input.approvalId && c.input.approvalId !== approval.id) throw new DomainError('CONFLICT', 'Cette demande a été remplacée. Rechargez avant de répondre.');
      if (c.nowMs >= Date.parse(approval.expiresAt)) throw new DomainError('FAMILY_APPROVAL_EXPIRED');
      break;
    }
    case 'EXPIRE': {
      if (!approval || approval.status !== 'pending' || c.nowMs < Date.parse(approval.expiresAt)) throw new DomainError('INVALID_TRANSITION');
      break;
    }
    case 'DROPOFF': {
      if (trip.handoverLocked) throw new DomainError('INVALID_TRANSITION', HANDOVER_LOCKED_MESSAGE, { locked: true });
      if (!c.input.proof) throw new DomainError('FAMILY_PROOF_REQUIRED', 'Photographiez l’enfant dans l’enceinte de l’école pour clôturer le trajet.');
      if (c.position) {
        const d = haversineMeters(c.position, trip.destination.location);
        if (d > FAMILY_DROPOFF_RADIUS_METERS)
          throw new DomainError('VALIDATION', `Vous n’êtes pas encore à l’école (à ${Math.round(d / 10) * 10} m). La photo doit être prise sur place.`);
      }
      if (requiresHandoverCode(c.child)) {
        const recipient = c.child.recipients.find((r) => r.id === c.input.recipientId);
        if (!recipient) throw new DomainError('VALIDATION', 'Choisissez la personne autorisée qui reçoit l’enfant.');
        if (!/^\d{4}$/.test(c.input.code ?? '')) throw new DomainError('VALIDATION', 'Saisissez le code à 4 chiffres de la personne autorisée.');
        // `wrongHandoverCode` lets the server count the attempt (HANDOVER_MAX_ATTEMPTS, then the handover locks).
        if (recipient.verificationCode !== c.input.code) throw new DomainError('VALIDATION', 'Code de remise incorrect.', { wrongHandoverCode: true });
      }
      break;
    }
    case 'CANCEL': {
      if (!c.input.reason?.trim()) throw new DomainError('REASON_REQUIRED');
      break;
    }
    default:
      break;
  }
  return next;
}

/** A new start request with its server-authoritative deadline. */
export function newStartApproval(id: string, nowMs: number): FamilyStartApproval {
  return {
    id,
    requestedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + FAMILY_APPROVAL_TIMEOUT_SECONDS * 1000).toISOString(),
    status: 'pending',
    mode: null,
    decidedAt: null,
    decidedBy: null,
    reason: null,
  };
}

export const approvalSecondsLeft = (a: Pick<FamilyStartApproval, 'expiresAt'>, nowMs: number) => Math.max(0, Math.ceil((Date.parse(a.expiresAt) - nowMs) / 1000));

/* ───────────── Live position (demo engine) ───────────── */

const place = (location: LatLng): Place => ({ id: null, label: '', address: '', location });

/** Where the demo chauffeuse sets off from: about 1,5 km north-east of the pick-up. */
export const familyDriverBase = (pickup: LatLng): LatLng => ({ lat: pickup.lat + 0.011, lng: pickup.lng + 0.009 });

export function bearingDegrees(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

type LiveTrip = Pick<FamilyTrip, 'id' | 'status' | 'pickup' | 'destination' | 'location'> &
  Partial<Pick<FamilyTrip, 'departedAt' | 'startedAt' | 'lastFix' | 'approval'>>;

/**
 * Deterministic position of the chauffeuse at `nowMs`: a demo route from her base to the
 * pick-up, a stop at the pick-up until the parent approves, then the pick-up → school route.
 * A fresh device position (`lastFix`) always wins over the simulation.
 */
export function familyLive(trip: LiveTrip, nowMs: number, timeFactor = FAMILY_DEMO_TIME_FACTOR): FamilyLive {
  const serverTime = new Date(nowMs).toISOString();
  const approval = trip.approval && trip.approval.status === 'pending' ? { ...trip.approval, secondsLeft: approvalSecondsLeft(trip.approval, nowMs) } : null;
  const base = { tripId: trip.id, status: trip.status, serverTime, timeFactor, approval };
  const along = (stops: LatLng[], sinceIso: string | null | undefined, leg: FamilyLive['leg']): FamilyLive => {
    const route = demoRoute(stops.map(place));
    const wallMs = (route.durationSeconds * 1000) / timeFactor;
    const t = sinceIso ? Math.min(1, Math.max(0, (nowMs - Date.parse(sinceIso)) / wallMs)) : 0;
    const location = pointAlong(route.polyline, t);
    const ahead = pointAlong(route.polyline, Math.min(1, t + 0.02));
    return {
      ...base,
      location,
      at: serverTime,
      source: 'demo',
      stale: false,
      ageSeconds: 0,
      heading: t < 1 ? bearingDegrees(location, ahead) : null,
      leg: t >= 1 && leg === 'to_school' ? 'arrived' : leg,
      route: route.polyline,
      progress: t,
      remainingMeters: Math.round(route.distanceMeters * (1 - t)),
      etaSeconds: Math.ceil(((1 - t) * route.durationSeconds) / timeFactor),
    };
  };
  const fixAge = trip.lastFix ? (nowMs - Date.parse(trip.lastFix.at)) / 1000 : Infinity;
  const target = trip.status === 'in_progress' ? trip.destination.location : trip.pickup.location;
  if (trip.lastFix && fixAge <= FAMILY_LIVE_STALE_SECONDS && (trip.status === 'en_route' || trip.status === 'in_progress')) {
    const remaining = Math.round(haversineMeters(trip.lastFix.location, target) * 1.35);
    return {
      ...base,
      location: trip.lastFix.location,
      at: trip.lastFix.at,
      source: 'gps',
      stale: false,
      ageSeconds: Math.round(fixAge),
      heading: bearingDegrees(trip.lastFix.location, target),
      leg: trip.status === 'in_progress' ? 'to_school' : 'to_pickup',
      route: [trip.lastFix.location, target],
      progress: 0,
      remainingMeters: remaining,
      etaSeconds: Math.ceil(remaining / (24_000 / 3600)),
    };
  }
  switch (trip.status) {
    case 'en_route':
      return along([familyDriverBase(trip.pickup.location), trip.pickup.location], trip.departedAt, 'to_pickup');
    case 'in_progress':
      return along([trip.pickup.location, trip.destination.location], trip.startedAt, 'to_school');
    case 'arrived':
    case 'picked_up':
    case 'awaiting_approval': {
      const r = along([trip.pickup.location, trip.destination.location], null, 'at_pickup');
      return { ...r, etaSeconds: null };
    }
    default:
      return {
        ...base,
        location: trip.status === 'scheduled' ? familyDriverBase(trip.pickup.location) : trip.location,
        at: serverTime,
        source: 'demo',
        stale: false,
        ageSeconds: 0,
        heading: null,
        leg: trip.status === 'completed' ? 'arrived' : 'idle',
        route: [trip.pickup.location, trip.destination.location],
        progress: trip.status === 'completed' ? 1 : 0,
        remainingMeters: 0,
        etaSeconds: null,
      };
  }
}

/** WhatsApp hand-off link (opens the chat; the call button is one tap inside WhatsApp). */
export function whatsappLink(phoneE164: string, scheme: 'https' | 'app' = 'https') {
  const digits = phoneE164.replace(/\D/g, '');
  return scheme === 'app' ? `whatsapp://send?phone=${digits}` : `https://wa.me/${digits}`;
}

/** Morocco police (Police secours). */
export const MOROCCO_POLICE_NUMBER = '19';

/* ───────────── Request schemas ───────────── */

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const shortText = z.string().trim().min(1).max(300);

export const familyApprovalSchema = z.object({
  decision: z.enum(['approve', 'refuse']),
  mode: z.enum(['on_site', 'remote']),
  approvalId: z.string().min(1),
  reason: z.string().trim().max(300).optional(),
});
export type FamilyApprovalInput = z.infer<typeof familyApprovalSchema>;

export const familyCallSchema = z.object({
  channel: z.enum(['whatsapp', 'police']),
  /** The person saw and accepted the confirmation sheet. */
  confirmed: z.literal(true),
});
export type FamilyCallInput = z.infer<typeof familyCallSchema>;
export interface FamilyCallResult {
  channel: 'whatsapp' | 'police';
  /** `https://wa.me/…` or `tel:19`. */
  url: string;
  /** `whatsapp://send?phone=…` when the app is installed. */
  appUrl: string | null;
  /** In demo builds the WhatsApp hand-off is recorded but not opened. */
  simulated: boolean;
  counterpartName: string;
}

export const familyPositionSchema = z.object({ location: latLng });
export const familyCancelSchema = z.object({ reason: shortText });
export const familyGuardianSchema = z.object({
  name: z.string().trim().min(2).max(60),
  relationship: z.string().trim().min(2).max(40),
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, 'Numéro au format international, par exemple +212612345678.')
    .nullable(),
});
export type FamilyGuardianInput = z.infer<typeof familyGuardianSchema>;

export const familyAdvanceSchema = z.object({
  expectedStatus: z.enum(['scheduled', 'en_route', 'arrived', 'picked_up', 'awaiting_approval', 'in_progress']),
  proof: z.string().max(200).optional(),
  childName: z.string().max(60).optional(),
  recipientId: z.string().max(60).optional(),
  code: z.string().max(10).optional(),
});
export type FamilyAdvanceInput = z.infer<typeof familyAdvanceSchema>;

export const familyDemoSchema = z.object({
  driver: z.boolean(),
  parent: z.enum(['approve', 'refuse', 'timeout']).nullable(),
});
