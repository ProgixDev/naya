import type { Centimes } from './money';
import type { LatLng, Place } from './entities';

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
  status: 'active' | 'paused';
  startsAt: string;
  endsAt: string;
}
export type FamilyTripStatus =
  | 'scheduled'
  | 'en_route'
  | 'arrived'
  | 'picked_up'
  | 'in_progress'
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
  pickupVerified: boolean;
  timeline: { at: string; label: string; location: LatLng; proof?: string }[];
  notifications: { at: string; title: string }[];
  incident: string | null;
  incidents?: FamilyIncident[];
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
}
export const FAMILY_STATUS_LABELS: Record<FamilyTripStatus, string> = {
  scheduled: 'Planifié',
  en_route: 'Chauffeuse en route',
  arrived: 'Chauffeuse arrivée',
  picked_up: 'Enfant récupéré',
  in_progress: 'Trajet en cours',
  completed: 'Remis à une personne autorisée',
};
export const FAMILY_NEXT: Partial<Record<FamilyTripStatus, FamilyTripStatus>> =
  {
    scheduled: 'en_route',
    en_route: 'arrived',
    arrived: 'picked_up',
    picked_up: 'in_progress',
    in_progress: 'completed',
  };

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
