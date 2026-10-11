import type { Centimes } from './money';
import type { LatLng, PaymentInstructions, Place } from './entities';
import { DRIVER_CANCEL_REASONS, PASSENGER_CANCEL_REASONS } from './labels';

/** Pictograms a service category can use (each app maps them to its icon set). */
export const SERVICE_ICONS = ['car', 'scooter', 'premium', 'van', 'electric', 'accessible', 'family', 'luxury', 'package'] as const;
export type ServiceIcon = (typeof SERVICE_ICONS)[number];
export const SERVICE_ICON_LABELS: Record<ServiceIcon, { label: string; hint: string }> = {
  car: { label: 'Voiture', hint: 'Berline standard' },
  scooter: { label: 'Scooter', hint: 'Deux-roues' },
  premium: { label: 'Confort', hint: 'Premium' },
  van: { label: 'Van', hint: '6 à 7 places' },
  electric: { label: 'Électrique', hint: 'Zéro émission' },
  accessible: { label: 'Accessible', hint: 'Mobilité réduite' },
  family: { label: 'Famille', hint: 'Siège enfant' },
  luxury: { label: 'Prestige', hint: 'Haut de gamme' },
  package: { label: 'Colis', hint: 'Livraison' },
};

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: ServiceIcon;
  enabled: boolean;
  cityIds: string[];
  etaMinutes: number;
  commissionBp: number;
  baseFare: Centimes | null;
  perKm: Centimes | null;
  perMinute: Centimes | null;
  minimumFare: Centimes | null;
  /** Category-specific conditions shown to the passenger before booking. */
  conditions: string[];
}
export interface ServiceSelection {
  id: string;
  name: string;
  icon: ServiceCategory['icon'];
  etaMinutes: number;
  commissionBp: number;
  conditions?: string[];
}
/** Estimated price of one available category for the same route. */
export interface ServiceOption {
  id: string;
  name: string;
  description: string;
  icon: ServiceCategory['icon'];
  etaMinutes: number;
  total: Centimes;
  conditions: string[];
}
export interface FamilyPlan {
  id: string;
  name: string;
  price: Centimes;
  durationDays: number;
  includedTrips: number;
  enabled: boolean;
  features: string[];
  /** One assigned driver for the family (otherwise trips go to the pool of family drivers). */
  dedicatedDriver?: boolean;
}
export interface DisputeReason {
  id: string;
  label: string;
  category: 'ride' | 'payment' | 'safety' | 'account' | 'wallet' | 'other';
  evidenceRequired: boolean;
  enabled: boolean;
  /** Who may pick this reason; empty = everyone. */
  roles?: ('passenger' | 'driver')[];
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
  /** Cancellation reasons offered to passengers and drivers (admin-editable). */
  cancelReasons?: CancelReason[];
  payments: DemoPaymentOption[];
  version: number;
}
export const RECIPIENT_RELATIONSHIPS = [
  'Mère',
  'Père',
  'Grand-parent',
  'Tuteur',
  'Personne autorisée',
] as const;
export interface AuthorizedRecipient {
  id: string;
  name: string;
  relationship: string;
  /** Shown to the driver at handover, together with the 4-digit code. */
  phone?: string;
  verificationCode: string;
}
export interface FamilyChild {
  id: string;
  passengerId: string;
  firstName: string;
  age: number;
  /** Upload id of the child's photo, shown to the dedicated driver at pickup. */
  photo?: string | null;
  school: string;
  /** School or usual destination address. */
  schoolPlace?: Place | null;
  /** Important information for the trip (allergies, instructions…). */
  notes: string;
  recipients: AuthorizedRecipient[];
}
export type FamilyTripKind = 'home_school' | 'school_home' | 'activity_home' | 'other';
export const FAMILY_TRIP_KINDS: Record<FamilyTripKind, string> = {
  home_school: 'Maison → école',
  school_home: 'École → maison',
  activity_home: 'Activité → maison',
  other: 'Autre trajet',
};
export interface FamilyIncident {
  at: string;
  by: string;
  message: string;
  location: LatLng;
  /** `auto` alerts are raised by the platform (delay, unusual stop). */
  source: 'driver' | 'parent' | 'auto';
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
  /** false: "pool" plan, each trip goes to the least busy available verified driver. */
  dedicated?: boolean;
  status: 'active' | 'paused' | 'cancelled';
  startsAt: string;
  endsAt: string;
  statusHistory?: { at: string; by: string; status: 'active' | 'paused' | 'cancelled'; reason: string }[];
}
export const SUBSCRIPTION_STATUS_LABELS: Record<FamilySubscription['status'], string> = {
  active: 'Actif',
  paused: 'Suspendu',
  cancelled: 'Résilié',
};
/** Back-office view of a driver who can serve families. */
export interface DedicatedDriverSummary {
  id: string;
  name: string;
  cityId: string;
  phone: string;
  online: boolean;
  /** Accepts new families. */
  available: boolean;
  verified: boolean;
  rating: number | null;
  vehicle: string | null;
  families: { subscriptionId: string; passengerId: string; passengerName: string; status: FamilySubscription['status'] }[];
  trips: { total: number; completed: number; upcoming: number; lastAt: string | null };
  incidents: number;
  sos: number;
}
export type FamilyTripStatus =
  | 'scheduled'
  | 'en_route'
  | 'arrived'
  | 'picked_up'
  | 'in_progress'
  | 'at_destination'
  | 'completed';
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
  kind?: FamilyTripKind;
  status: FamilyTripStatus;
  location: LatLng;
  /** Road path pickup → destination, used for live tracking. */
  route?: LatLng[];
  durationSeconds?: number;
  /** Vehicle of the dedicated driver, frozen when she sets off. */
  vehicle?: { make: string; model: string; color: string; plate: string } | null;
  /** When each step was confirmed (traceability). */
  times?: Partial<Record<FamilyTripStatus, string>>;
  /** Simulated unusual stop: movement is frozen from this time. */
  stoppedAt?: string | null;
  /** Total time spent stopped, excluded from progress along the route. */
  pausedMs?: number;
  /** Automatic alerts already raised for this trip. */
  alertsSent?: string[];
  recipientId: string | null;
  arrivalProof: string | null;
  /** Optional verification photo taken when the child is picked up. */
  pickupProof?: string | null;
  /** Last position received from the driver's phone (real GPS); simulated movement stops while it is fresh. */
  liveAt?: string | null;
  /** Last time the real position moved by more than ~40 m (unusual stop detection). */
  movedAt?: string | null;
  movedFrom?: LatLng | null;
  /** Real GPS trace, sampled (traceability). */
  track?: { at: string; location: LatLng }[];
  pickupVerified: boolean;
  timeline: { at: string; label: string; location: LatLng; proof?: string }[];
  notifications: { at: string; title: string }[];
  incident: string | null;
  incidents?: FamilyIncident[];
}
export type SafetyActionCode =
  | 'emergency_call'
  | 'share_location'
  | 'trusted_contact'
  | 'support';
export const SAFETY_ACTION_LABELS: Record<SafetyActionCode, string> = {
  emergency_call: 'Appel aux services d’urgence lancé depuis le téléphone',
  share_location: 'Position partagée depuis le téléphone',
  trusted_contact: 'Contact de confiance alerté par SMS',
  support: 'Support Naya contacté',
};
export const SAFETY_STATUS_LABELS: Record<SafetyAlert['status'], string> = {
  new: 'Nouvelle · en attente de Naya',
  responding: 'Prise en charge par l’équipe Naya',
  resolved: 'Résolue',
};
export interface SafetyAlert {
  id: string;
  /** Who triggered the alert. */
  userId: string;
  userName: string;
  role: 'passenger' | 'driver';
  rideId: string | null;
  familyTripId: string | null;
  /** Both people of the trip, frozen when the alert is raised. */
  passengerId?: string | null;
  passengerName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  /** What the person reported, optional. */
  note?: string | null;
  /** GPS position at the moment the alert was raised. */
  location: LatLng;
  /** `device`: the phone's own GPS when SOS was pressed; `trip`: last known trip position. */
  locationSource?: 'device' | 'trip';
  /** GPS accuracy in metres, when known. */
  locationAccuracy?: number | null;
  createdAt: string;
  status: 'new' | 'responding' | 'resolved';
  actions: { at: string; by: string; label: string }[];
  contactName: string;
  contactPhone?: string | null;
  ticketId?: string | null;
}
export interface PassengerWalletEntry extends PaymentInstructions {
  id: string;
  amount: Centimes;
  label: string;
  status: 'pending' | 'confirmed' | 'failed';
  at: string;
  rideId: string | null;
  providerId: string | null;
  /** Recharges: reference of the operation at the provider (callbacks are matched on it). */
  providerRef?: string | null;
  failureReason?: string | null;
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
  /** Driver id → accepts new families (default true). */
  familyAvailability?: Record<string, boolean>;
}
export interface FamilyOverview {
  children: FamilyChild[];
  subscription: FamilySubscription | null;
  trips: FamilyTrip[];
}
export interface PrototypeAdmin extends PrototypeState {
  people: {
    id: string;
    name: string;
    role: 'passenger' | 'driver';
    cityId: string;
  }[];
  dedicatedDrivers: DedicatedDriverSummary[];
}
export const FAMILY_STATUS_LABELS: Record<FamilyTripStatus, string> = {
  scheduled: 'Planifié',
  en_route: 'Chauffeuse en route',
  arrived: 'Chauffeuse arrivée',
  picked_up: 'Enfant récupéré',
  in_progress: 'Trajet en cours',
  at_destination: 'Arrivée à destination',
  completed: 'Remis à une personne autorisée',
};
export const FAMILY_NEXT: Partial<Record<FamilyTripStatus, FamilyTripStatus>> =
  {
    scheduled: 'en_route',
    en_route: 'arrived',
    arrived: 'picked_up',
    picked_up: 'in_progress',
    in_progress: 'at_destination',
    at_destination: 'completed',
  };

export function defaultDisputeReasons(): DisputeReason[] {
  return (
    [
      ['driver_behavior', 'Problème avec la chauffeuse', 'ride', false, ['passenger']],
      ['passenger_behavior', 'Problème avec la cliente', 'ride', false, ['driver']],
      ['payment_issue', 'Problème de paiement', 'payment', false, []],
      ['wrong_fare', 'Prix incorrect', 'payment', false, []],
      ['wrong_billing', 'Course incorrectement facturée', 'payment', false, []],
      ['vehicle_problem', 'Problème avec le véhicule', 'ride', true, ['passenger']],
      ['lost_item', 'Objet perdu', 'ride', false, []],
      ['accident', 'Accident', 'safety', true, []],
      ['inappropriate', 'Comportement inapproprié', 'safety', false, []],
      ['security', 'Problème de sécurité', 'safety', false, []],
      ['not_completed', 'Course non effectuée', 'ride', false, []],
      ['wallet_issue', 'Recharge ou portefeuille', 'wallet', false, []],
      ['other', 'Autre', 'other', false, []],
    ] as const
  ).map(([id, label, category, evidenceRequired, roles]) => ({
    id,
    label,
    category,
    evidenceRequired,
    enabled: true,
    roles: [...roles],
  }));
}

export interface CancelReason {
  id: string;
  label: string;
  role: 'passenger' | 'driver';
  enabled: boolean;
}
export function defaultCancelReasons(): CancelReason[] {
  return [
    ...PASSENGER_CANCEL_REASONS.map((r) => ({ id: r.code, label: r.label, role: 'passenger' as const, enabled: true })),
    ...DRIVER_CANCEL_REASONS.map((r) => ({ id: r.code, label: r.label, role: 'driver' as const, enabled: true })),
  ];
}
/** Reasons offered to one role; `other` (free text) always stays last. */
export function cancelReasonsFor(catalog: { cancelReasons?: CancelReason[] } | undefined, role: 'passenger' | 'driver') {
  const list = (catalog?.cancelReasons ?? defaultCancelReasons()).filter((r) => r.role === role && r.enabled);
  return [...list.filter((r) => r.id !== 'other'), ...list.filter((r) => r.id === 'other')].map((r) => ({ code: r.id, label: r.label }));
}

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
        conditions: ['1 passagère maximum', 'Casque fourni', 'Petit bagage uniquement'],
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
        conditions: ['Jusqu’à 4 passagères'],
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
        conditions: ['Jusqu’à 4 passagères', 'Véhicule récent et climatisé', 'Grand coffre'],
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
        dedicatedDriver: true,
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
        dedicatedDriver: true,
        features: [
          'Chauffeuse dédiée',
          '40 trajets par mois',
          'École et activités',
          'Suivi et confirmations',
        ],
      },
    ],
    reasons: defaultDisputeReasons(),
    cancelReasons: defaultCancelReasons(),
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
