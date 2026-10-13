import type { Centimes } from './money';
import type { AdminPermission, FamilleEligibility, LatLng, Place, RideStatus } from './entities';

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: 'car' | 'scooter' | 'premium';
  enabled: boolean;
  cityIds: string[];
  etaMinutes: number;
  commissionBp: number;
  baseFare: Centimes | null;
  perKm: Centimes | null;
  perMinute: Centimes | null;
  minimumFare: Centimes | null;
}
export interface ServiceSelection {
  id: string;
  name: string;
  icon: ServiceCategory['icon'];
  etaMinutes: number;
  commissionBp: number;
}
export interface FamilyPlan {
  id: string;
  name: string;
  price: Centimes;
  durationDays: number;
  includedTrips: number;
  enabled: boolean;
  features: string[];
}
export interface DisputeReason {
  id: string;
  label: string;
  category: 'ride' | 'payment' | 'safety' | 'account' | 'wallet' | 'other';
  evidenceRequired: boolean;
  enabled: boolean;
}
export interface DemoPaymentOption {
  id: string;
  name: string;
  enabled: boolean;
  kind: 'card' | 'mobile' | 'agency';
  cityIds: string[];
}
export interface PrototypeCatalog {
  categories: ServiceCategory[];
  plans: FamilyPlan[];
  reasons: DisputeReason[];
  payments: DemoPaymentOption[];
  version: number;
}
export interface AuthorizedRecipient {
  id: string;
  name: string;
  relationship: string;
  /** Known to the parent and the recipient only: checked by the server, never sent to the chauffeuse. */
  verificationCode: string;
}
/** A child as `/prototype/family` returns it: the parent sees her handover codes, the chauffeuse gets recipients without them. */
export interface FamilyChildView extends Omit<FamilyChild, 'recipients'> {
  recipients: (Omit<AuthorizedRecipient, 'verificationCode'> & {
    verificationCode?: string;
  })[];
}
export interface FamilyChild {
  id: string;
  passengerId: string;
  firstName: string;
  age: number;
  school: string;
  notes: string;
  recipients: AuthorizedRecipient[];
}
export interface FamilySubscription {
  id: string;
  passengerId: string;
  planId: string;
  planName: string;
  price: Centimes;
  includedTrips: number;
  driverId: string;
  driverName: string;
  status: 'active' | 'paused';
  startsAt: string;
  endsAt: string;
}
export type FamilyTripStatus =
  | 'scheduled'
  | 'en_route'
  | 'arrived'
  | 'picked_up'
  | 'awaiting_approval'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
/** A photo taken by the chauffeuse: the child at pick-up, then on the school premises. */
export interface FamilyProof {
  uploadId: string;
  at: string;
  location: LatLng;
  /** Dev-mode stand-in (no camera); labelled « simulée » everywhere. */
  simulated: boolean;
}
/** How the parent approved the start: next to the car, or from the notification. */
export type FamilyApprovalMode = 'on_site' | 'remote';
export interface FamilyStartApproval {
  id: string;
  requestedAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'refused' | 'expired';
  mode: FamilyApprovalMode | null;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string | null;
}
export type FamilyTimelineKind =
  | 'planned'
  | 'departed'
  | 'arrived'
  | 'pickup_photo'
  | 'start_requested'
  | 'start_approved'
  | 'start_refused'
  | 'start_expired'
  | 'live_started'
  | 'dropoff_photo'
  | 'completed'
  | 'cancelled'
  | 'call'
  | 'call_request'
  | 'police'
  | 'invite'
  | 'incident';
export interface FamilyTimelineEntry {
  at: string;
  label: string;
  location: LatLng;
  proof?: string;
  kind?: FamilyTimelineKind;
  actor?: 'parent' | 'driver' | 'system';
}
export interface FamilyNotification {
  id?: string;
  at: string;
  title: string;
  body?: string;
  kind?: 'approval_request' | 'approval_result' | 'call_request' | 'status' | 'police' | 'incident';
  /** Who should be told. Missing on trips recorded before 13 Oct: treated as the parent. */
  audience?: 'parent' | 'driver';
  approvalId?: string;
}
/** Demo engine switches for one trip: who is simulated, and how the simulated parent answers. */
export interface FamilyDemoControls {
  driver: boolean;
  parent: 'approve' | 'refuse' | 'timeout' | null;
}
export interface FamilyTrip {
  id: string;
  passengerId: string;
  childId: string;
  childName: string;
  driverId: string;
  driverName: string;
  pickup: Place;
  destination: Place;
  pickupAt: string;
  weekdays: number[];
  status: FamilyTripStatus;
  location: LatLng;
  recipientId: string | null;
  /** Legacy (6 Oct flow): photo on arrival, before the child was collected. */
  arrivalProof: string | null;
  /** The chauffeuse's attestation that she asked the child's first name. Not an identity check. */
  pickupVerified: boolean;
  /** Wrong handover codes entered on this trip; at HANDOVER_MAX_ATTEMPTS the handover is locked. */
  handoverAttempts?: number;
  handoverLocked?: boolean;
  timeline: FamilyTimelineEntry[];
  notifications: FamilyNotification[];
  incident: string | null;
  /* Fields below were added on 13 Oct; trips stored before that have none of them. */
  pickupPhoto?: FamilyProof | null;
  dropoffPhoto?: FamilyProof | null;
  /** The current (or last) start request. */
  approval?: FamilyStartApproval | null;
  approvals?: FamilyStartApproval[];
  departedAt?: string | null;
  arrivedAt?: string | null;
  pickedUpAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancellation?: { at: string; by: 'parent' | 'driver'; reason: string } | null;
  /** Last device position sent by the chauffeuse during this trip. */
  lastFix?: { location: LatLng; at: string } | null;
  demo?: FamilyDemoControls | null;
}
/** A co-parent (or other relative) invited by the parent to follow trips through a private link. */
export interface FamilyGuardian {
  id: string;
  passengerId: string;
  name: string;
  relationship: string;
  phone: string | null;
  status: 'invited' | 'active' | 'revoked';
  /** SHA-256 of the follow token; the token itself is only returned when it is created. */
  tokenHash: string;
  createdAt: string;
  lastViewedAt: string | null;
  revokedAt: string | null;
}
export type FamilyGuardianView = Omit<FamilyGuardian, 'tokenHash'>;
/** Live position of a Famille trip, polled every second while it is active. */
export interface FamilyLive {
  tripId: string;
  status: FamilyTripStatus;
  location: LatLng;
  at: string;
  source: 'demo' | 'gps';
  stale: boolean;
  ageSeconds: number;
  heading: number | null;
  leg: 'idle' | 'to_pickup' | 'at_pickup' | 'to_school' | 'arrived';
  /** Polyline of the current leg. */
  route: LatLng[];
  progress: number;
  remainingMeters: number;
  /** Wall-clock seconds to the next stop (the demo runs accelerated). */
  etaSeconds: number | null;
  approval: (FamilyStartApproval & { secondsLeft: number }) | null;
  serverTime: string;
  timeFactor: number;
}
/** What a follow link shows: no photos, no codes, no phone numbers. */
export interface FamilyFollowView {
  guardianName: string;
  parentFirstName: string;
  trips: {
    id: string;
    childName: string;
    driverFirstName: string;
    status: FamilyTripStatus;
    pickup: Place;
    destination: Place;
    pickupAt: string;
    timeline: { at: string; label: string; kind?: FamilyTimelineKind }[];
    live: FamilyLive | null;
  }[];
}
export interface SafetyAlert {
  id: string;
  userId: string;
  userName: string;
  role: 'passenger' | 'driver';
  rideId: string | null;
  familyTripId: string | null;
  location: LatLng;
  createdAt: string;
  status: 'new' | 'responding' | 'resolved';
  actions: { at: string; by: string; label: string }[];
  contactName: string;
  /** Admin who took charge of the alert (absent on alerts stored before ownership existed). */
  ownerId?: string | null;
  ownerName?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}
export const SAFETY_STATUS_LABELS: Record<SafetyAlert['status'], string> = {
  new: 'Nouvelle',
  responding: 'Prise en charge',
  resolved: 'Résolue',
};
/** Forward only: an alert is taken in charge, then resolved (with a note); it never goes back. */
export const SAFETY_TRANSITIONS: Record<
  SafetyAlert['status'],
  SafetyAlert['status'][]
> = {
  new: ['responding', 'resolved'],
  responding: ['resolved'],
  resolved: [],
};
/**
 * `safety.respond` grants the SOS queue. Admin records stored before it existed (dev JSON
 * store) do not carry it: `config.edit` holders, the only SOS responders until then, keep
 * access without a reseed. Everyone else needs the explicit permission.
 */
export const canRespondToSafety = (permissions: readonly AdminPermission[]) =>
  permissions.includes('safety.respond') || permissions.includes('config.edit');
/** An SOS alert as the safety desk sees it: the reporter, the city and the ride or family trip it concerns. */
export interface AdminSafetyAlert extends SafetyAlert {
  cityId: string | null;
  reporterPhone: string | null;
  ride: {
    id: string;
    status: RideStatus;
    pickup: string;
    destination: string;
    passengerName: string;
    driverName: string | null;
  } | null;
  trip: {
    id: string;
    childName: string;
    status: FamilyTripStatus;
    driverName: string;
    pickup: string;
    destination: string;
  } | null;
}
export interface PassengerWalletEntry {
  id: string;
  amount: Centimes;
  label: string;
  status: 'pending' | 'confirmed' | 'failed';
  at: string;
  rideId: string | null;
  providerId: string | null;
}
export interface PassengerWallet {
  userId: string;
  balance: Centimes;
  reserved: Centimes;
  entries: PassengerWalletEntry[];
}
export interface PrototypeState {
  catalog: PrototypeCatalog;
  children: FamilyChild[];
  subscriptions: FamilySubscription[];
  trips: FamilyTrip[];
  alerts: SafetyAlert[];
  wallets: PassengerWallet[];
  driverCategories: Record<string, string[]>;
  /** Added 13 Oct; absent in older stores. */
  guardians?: FamilyGuardian[];
}
export interface FamilyOverview {
  children: FamilyChildView[];
  subscription: FamilySubscription | null;
  trips: FamilyTrip[];
  /** Parent only: people she invited to follow the trips. */
  guardians?: FamilyGuardianView[];
  /** Driver only: her Naya Famille vetting status. */
  eligibility?: FamilleEligibility;
}
export interface PrototypeAdmin extends PrototypeState {
  people: {
    id: string;
    name: string;
    role: 'passenger' | 'driver';
    cityId: string;
    familleEligibility?: FamilleEligibility;
  }[];
}
export const FAMILY_STATUS_LABELS: Record<FamilyTripStatus, string> = {
  scheduled: 'Planifié',
  en_route: 'Chauffeuse en route',
  arrived: 'Chauffeuse arrivée',
  picked_up: 'Enfant récupéré',
  awaiting_approval: 'Départ en attente de l’accord du parent',
  in_progress: 'Trajet en cours',
  completed: 'Déposé · photo et remise confirmées',
  cancelled: 'Trajet annulé',
};
/** Wrong handover codes allowed on one trip before the handover is locked. */
export const HANDOVER_MAX_ATTEMPTS = 5;

export function defaultPrototypeCatalog(): PrototypeCatalog {
  return {
    version: 1,
    categories: [
      {
        id: 'scooter',
        name: 'Naya Scooter',
        description: 'Pour vos petits trajets en ville',
        icon: 'scooter',
        enabled: true,
        cityIds: [],
        etaMinutes: 3,
        commissionBp: 1500,
        baseFare: 600,
        perKm: 200,
        perMinute: 100,
        minimumFare: 1500,
      },
      {
        id: 'standard',
        name: 'Naya Standard',
        description: 'Votre trajet quotidien, entre femmes',
        icon: 'car',
        enabled: true,
        cityIds: [],
        etaMinutes: 5,
        commissionBp: 1500,
        baseFare: null,
        perKm: null,
        perMinute: null,
        minimumFare: null,
      },
      {
        id: 'premium',
        name: 'Naya Confort',
        description: 'Plus d’espace et de confort',
        icon: 'premium',
        enabled: true,
        cityIds: [],
        etaMinutes: 7,
        commissionBp: 1800,
        baseFare: 1800,
        perKm: 600,
        perMinute: 250,
        minimumFare: 5000,
      },
    ],
    plans: [
      {
        id: 'family-essential',
        name: 'Famille Essentiel',
        price: 59000,
        durationDays: 30,
        includedTrips: 20,
        enabled: true,
        features: [
          'Chauffeuse dédiée',
          '20 trajets par mois',
          'Suivi et confirmations',
          'Personnes autorisées',
        ],
      },
      {
        id: 'family-plus',
        name: 'Famille Confiance',
        price: 99000,
        durationDays: 30,
        includedTrips: 40,
        enabled: true,
        features: [
          'Chauffeuse dédiée',
          '40 trajets par mois',
          'École et activités',
          'Suivi et confirmations',
        ],
      },
    ],
    reasons: [
      ['wrong_fare', 'Prix incorrect', 'payment', false],
      ['not_completed', 'Course non effectuée', 'ride', false],
      ['vehicle_problem', 'Problème avec le véhicule', 'ride', true],
      ['lost_item', 'Objet perdu', 'ride', false],
      ['driver_behavior', 'Comportement de la chauffeuse', 'safety', false],
      ['passenger_behavior', 'Comportement de la cliente', 'safety', false],
      ['accident', 'Accident', 'safety', true],
      ['security', 'Problème de sécurité', 'safety', false],
      ['payment_issue', 'Problème de paiement', 'payment', false],
      ['wallet_issue', 'Recharge ou portefeuille', 'wallet', false],
      ['other', 'Autre', 'other', false],
    ].map(([id, label, category, evidenceRequired]) => ({
      id: String(id),
      label: String(label),
      category: category as DisputeReason['category'],
      evidenceRequired: Boolean(evidenceRequired),
      enabled: true,
    })),
    payments: [
      {
        id: 'demo-card',
        name: 'Carte bancaire',
        kind: 'card',
        enabled: true,
        cityIds: [],
      },
      {
        id: 'demo-mobile',
        name: 'Wallet marocain / paiement mobile',
        kind: 'mobile',
        enabled: true,
        cityIds: [],
      },
      {
        id: 'demo-cashplus',
        name: 'Cash Plus',
        kind: 'agency',
        enabled: true,
        cityIds: [],
      },
      {
        id: 'demo-wafacash',
        name: 'Wafacash',
        kind: 'agency',
        enabled: true,
        cityIds: [],
      },
    ],
  };
}
