import type { BasisPoints, Centimes, Currency } from './money';
import type { IsoUtc } from './time';

export type CityId = string;
export type UserId = string;
export type UploadId = string;

export interface LatLng {
  lat: number;
  lng: number;
}

/* ───────────────────────── People ───────────────────────── */

export type MobileRole = 'passenger' | 'driver';

export interface SavedPlace {
  id: string;
  kind: 'home' | 'work' | 'other';
  label: string;
  place: Place;
}

export interface NotificationPreferences {
  rideUpdates: boolean;
  scheduledReminders: boolean;
  supportReplies: boolean;
  offers: boolean; // driver: new ride offers
  product: boolean;
}

export interface User {
  id: UserId;
  role: MobileRole;
  phone: string; // E.164
  firstName: string;
  lastName: string;
  cityId: CityId;
  status: 'active' | 'suspended';
  /** Cities where this account may book or drive while the city is in `test`. */
  testerCities: CityId[];
  createdAt: IsoUtc;
  savedPlaces: SavedPlace[];
  notifications: NotificationPreferences;
  /** Passenger: identity case. Driver: person case (identity + licence). */
  identityCaseId: string | null;
  /** Driver only. */
  vehicleId: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

export type AdminPermission =
  | 'verification.decide'
  | 'finance.read'
  | 'finance.correct'
  | 'config.edit'
  | 'support.resolve'
  | 'rides.read'
  | 'audit.read'
  | 'people.read';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  title: string;
  permissions: AdminPermission[];
}

/* ───────────────────────── Verification ───────────────────────── */

export type VerificationSubject = 'passenger_identity' | 'driver_identity' | 'vehicle';

export type VerificationStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'more_info_requested'
  | 'rejected';

export type VerificationItemKey =
  | 'selfie'
  | 'id_front'
  | 'id_back'
  | 'driving_licence'
  | 'vehicle_registration'
  | 'insurance'
  | 'vehicle_photos';

export interface VerificationItem {
  key: VerificationItemKey;
  uploadIds: UploadId[];
  status: 'missing' | 'provided' | 'accepted' | 'needs_correction';
  /** Reviewer note shown to the applicant when a correction is needed. */
  note: string | null;
}

export interface IdentityDetails {
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
  documentType: 'cin' | 'passport' | 'residence_permit';
  documentNumber: string;
}

export interface VehicleDetails {
  make: string;
  model: string;
  color: string;
  plate: string;
  year: number;
}

export type DecisionOutcome = 'approved' | 'more_info_requested' | 'rejected';

export interface VerificationDecision {
  outcome: DecisionOutcome;
  reasonCode: string | null;
  message: string;
  decidedBy: string;
  decidedByName: string;
  decidedAt: IsoUtc;
}

export interface VerificationCase {
  id: string;
  subject: VerificationSubject;
  userId: UserId;
  vehicleId: string | null;
  status: VerificationStatus;
  items: VerificationItem[];
  identity: IdentityDetails | null;
  vehicle: VehicleDetails | null;
  decision: VerificationDecision | null;
  history: { at: IsoUtc; status: VerificationStatus; by: string; note?: string }[];
  submittedAt: IsoUtc | null;
  updatedAt: IsoUtc;
  version: number;
}

export interface Vehicle extends VehicleDetails {
  id: string;
  driverId: UserId;
  caseId: string;
}

/* ───────────────────────── Cities and rules ───────────────────────── */

export interface ServiceZone {
  id: string;
  cityId: CityId;
  name: string;
  polygon: LatLng[];
  active: boolean;
}

export interface CancellationPolicy {
  /** Seconds after assignment during which a passenger cancels for free. */
  graceSeconds: number;
  feeAfterGrace: Centimes;
  feeAfterArrival: Centimes;
}

export interface DynamicPricingRule {
  enabled: boolean;
  multiplierBp: BasisPoints; // 12 000 = ×1,2
  /** French explanation shown to the passenger before commitment. */
  reason: string;
}

export interface CityRules {
  baseFare: Centimes;
  perKm: Centimes;
  perMinute: Centimes;
  minimumFare: Centimes;
  commissionBp: BasisPoints;
  debtLimit: Centimes; // positive number; balance ≤ −debtLimit blocks offers
  cancellation: CancellationPolicy;
  dynamic: DynamicPricingRule;
  offerTimeoutSeconds: number;
  searchTimeoutSeconds: number;
  quoteValiditySeconds: number;
  scheduling: { minLeadMinutes: number; maxDaysAhead: number; modifyCutoffMinutes: number };
  minimumWithdrawal: Centimes;
}

export type CityStatus = 'active' | 'test' | 'inactive';

export interface CityConfig {
  id: CityId;
  name: string;
  status: CityStatus;
  timezone: 'Africa/Casablanca';
  currency: Currency;
  center: LatLng;
  rules: CityRules;
  rulesVersion: number;
  updatedAt: IsoUtc;
  updatedBy: string;
}

export interface CityRulesVersion {
  cityId: CityId;
  version: number;
  rules: CityRules;
  createdAt: IsoUtc;
  createdBy: string;
  reason: string;
}

export type PaymentPurpose = 'ride' | 'recharge' | 'withdrawal';

export interface PaymentProviderConfig {
  id: string;
  cityId: CityId;
  purpose: PaymentPurpose;
  kind: 'cash' | 'card' | 'bank_transfer' | 'cash_network';
  /** Display name. Demo providers are named honestly as demo. */
  name: string;
  enabled: boolean;
  /** `demo` providers are simulated by the demo API; `live` require credentials. */
  mode: 'demo' | 'live';
  configured: boolean;
}

/* ───────────────────────── Routes, quotes, rides ───────────────────────── */

export interface Place {
  id: string | null;
  label: string;
  address: string;
  location: LatLng;
}

export interface Route {
  /** pickup, intermediate stops…, destination */
  stops: Place[];
  distanceMeters: number;
  durationSeconds: number;
  polyline: LatLng[];
  source: 'demo' | 'provider';
}

export interface FareBreakdown {
  baseFare: Centimes;
  distanceFare: Centimes;
  timeFare: Centimes;
  subtotal: Centimes;
  minimumAdjustment: Centimes;
  multiplierBp: BasisPoints;
  dynamicSurcharge: Centimes;
  total: Centimes;
}

export interface QuoteConditions {
  cancellation: CancellationPolicy;
  dynamic: { multiplierBp: BasisPoints; reason: string } | null;
  cityStatus: CityStatus;
}

export interface Quote {
  service?: import('./prototype').ServiceSelection;
  /** Estimates for every category available on this route, for comparison before booking. */
  options?: import('./prototype').ServiceOption[];
  id: string;
  passengerId: UserId;
  cityId: CityId;
  currency: Currency;
  ruleVersion: number;
  route: Route;
  breakdown: FareBreakdown;
  conditions: QuoteConditions;
  createdAt: IsoUtc;
  expiresAt: IsoUtc;
  status: 'open' | 'used' | 'expired';
}

/** Commercial terms frozen at booking. Later rule changes never alter them. */
export interface FrozenTerms {
  service?: import('./prototype').ServiceSelection;
  quoteId: string;
  cityId: CityId;
  currency: Currency;
  ruleVersion: number;
  breakdown: FareBreakdown;
  commissionBp: BasisPoints;
  cancellation: CancellationPolicy;
  dynamic: { multiplierBp: BasisPoints; reason: string } | null;
  acceptedAt: IsoUtc;
}

export type PaymentMethodKind = 'cash' | 'card' | 'wallet' | 'mobile_wallet';

export interface PaymentMethod {
  id: string;
  userId: UserId;
  kind: PaymentMethodKind;
  label: string;
  /** Card only: tokenised reference from the provider. Never a PAN. */
  providerToken: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface PaymentMethodRef {
  id: string;
  kind: PaymentMethodKind;
  label: string;
}

export type RideStatus =
  | 'searching'
  | 'driver_assigned'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_driver';

export type CancellationActor = 'passenger' | 'driver' | 'system';

export interface RideCancellation {
  by: CancellationActor;
  reasonCode: string;
  reasonText: string;
  fee: Centimes;
  at: IsoUtc;
}

export interface RideTimelineEvent {
  at: IsoUtc;
  type: string;
  actor: 'passenger' | 'driver' | 'system' | 'admin' | 'provider';
  label: string;
}

export interface DriverSummary {
  id: UserId;
  firstName: string;
  lastInitial: string;
  ratingAverage: number | null;
  phoneMasked: string;
  vehicle: { make: string; model: string; color: string; plate: string };
}

export interface PassengerSummary {
  id: UserId;
  firstName: string;
  ratingAverage: number | null;
}

export interface DriverLocation {
  location: LatLng;
  at: IsoUtc;
  source: 'demo' | 'gps';
  /** Computed by the server: no fresh position for more than 20 s. */
  stale: boolean;
}

export interface Ride {
  id: string;
  cityId: CityId;
  passengerId: UserId;
  passenger: PassengerSummary;
  driverId: UserId | null;
  driver: DriverSummary | null;
  status: RideStatus;
  route: Route;
  terms: FrozenTerms;
  paymentMethod: PaymentMethodRef;
  paymentId: string | null;
  /** Intermediate stops already completed (0…stops.length − 2). */
  completedStops: number;
  requestedAt: IsoUtc;
  searchStartedAt: IsoUtc;
  assignedAt: IsoUtc | null;
  arrivedAt: IsoUtc | null;
  startedAt: IsoUtc | null;
  completedAt: IsoUtc | null;
  cancellation: RideCancellation | null;
  driverCancellations: { driverId: UserId; reasonCode: string; reasonText: string; at: IsoUtc }[];
  scheduledBookingId: string | null;
  rating: { stars: number; comment: string | null; at: IsoUtc } | null;
  driverLocation: DriverLocation | null;
  timeline: RideTimelineEvent[];
  /** Demo-only marker: vehicle movement is simulated and labelled as such. */
  simulated: boolean;
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn';

export interface DriverOffer {
  service?: import('./prototype').ServiceSelection;
  id: string;
  rideId: string;
  driverId: UserId;
  status: OfferStatus;
  createdAt: IsoUtc;
  /** Authoritative deadline. Clients compute remaining time against it. */
  expiresAt: IsoUtc;
  respondedAt: IsoUtc | null;
  declineReason: string | null;
  fare: Centimes;
  commission: Centimes;
  estimatedNet: Centimes;
  paymentKind: PaymentMethodKind;
  pickupEtaSeconds: number;
  pickupDistanceMeters: number;
  route: Route;
  passenger: PassengerSummary;
}

export type ScheduledStatus = 'scheduled' | 'dispatched' | 'cancelled' | 'expired';

export interface ScheduledBooking {
  id: string;
  passengerId: UserId;
  cityId: CityId;
  route: Route;
  terms: FrozenTerms;
  paymentMethod: PaymentMethodRef;
  pickupAt: IsoUtc;
  status: ScheduledStatus;
  rideId: string | null;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
  cancellation: { reasonCode: string; reasonText: string; at: IsoUtc } | null;
  history: { at: IsoUtc; label: string }[];
}

/* ───────────────────────── Money movements ───────────────────────── */

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';

export interface Payment {
  id: string;
  rideId: string | null;
  payerId: UserId;
  purpose: 'ride' | 'cancellation_fee';
  method: PaymentMethodKind;
  amount: Centimes;
  status: PaymentStatus;
  provider: string;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export type LedgerEntryType =
  | 'ride_commission'
  | 'ride_net_credit'
  | 'cancellation_fee_credit'
  | 'recharge'
  | 'withdrawal'
  | 'correction';

export interface LedgerEntry {
  id: string;
  driverId: UserId;
  type: LedgerEntryType;
  /** Signed centimes: credits positive, debits negative. */
  amount: Centimes;
  balanceAfter: Centimes;
  description: string;
  rideId: string | null;
  rechargeId: string | null;
  withdrawalId: string | null;
  correctionId: string | null;
  createdAt: IsoUtc;
  /** Unique per business event, guarantees at-most-once posting. */
  idempotencyKey: string;
}

export type TransferStatus = 'pending' | 'confirmed' | 'failed';

export interface Recharge {
  id: string;
  driverId: UserId;
  cityId: CityId;
  amount: Centimes;
  providerId: string;
  providerName: string;
  status: TransferStatus;
  providerRef: string;
  failureReason: string | null;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export interface Withdrawal {
  id: string;
  driverId: UserId;
  cityId: CityId;
  amount: Centimes;
  providerId: string;
  destinationLabel: string;
  status: TransferStatus;
  providerRef: string;
  failureReason: string | null;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export interface PayoutAccount {
  id: string;
  driverId: UserId;
  label: string;
  bankName: string;
  last4: string;
}

export interface Wallet {
  driverId: UserId;
  cityId: CityId;
  currency: Currency;
  /** Accounting balance: sum of posted ledger entries. */
  balance: Centimes;
  /** Held by pending withdrawals. Not a ledger movement. */
  reserved: Centimes;
  /** Withdrawable now: max(0, balance − reserved). */
  available: Centimes;
  /** Commission owed: max(0, −balance). */
  debt: Centimes;
  debtLimit: Centimes;
  offersBlockedByDebt: boolean;
  pendingRecharges: Centimes;
  updatedAt: IsoUtc;
}

export interface EarningsSummary {
  from: IsoUtc | null;
  to: IsoUtc | null;
  rideCount: number;
  gross: Centimes;
  commission: Centimes;
  net: Centimes;
  /** Cash taken physically from passengers (never in the wallet). */
  cashCollected: Centimes;
  /** Net amounts credited to the wallet for electronic rides. */
  walletCredited: Centimes;
  /** Electronic rides whose payment is not confirmed yet. */
  pendingElectronic: Centimes;
  rides: { rideId: string; completedAt: IsoUtc; method: PaymentMethodKind; gross: Centimes; commission: Centimes; net: Centimes; paymentStatus: PaymentStatus }[];
}

/* ───────────────────────── Support and audit ───────────────────────── */

export type SupportStatus = 'open' | 'in_progress' | 'awaiting_user' | 'resolved' | 'rejected';

export interface SupportMessage {
  id: string;
  author: 'user' | 'agent' | 'system';
  authorName: string;
  body: string;
  attachments: UploadId[];
  at: IsoUtc;
}

export interface SupportTicket {
  reasonId?: string;
  id: string;
  userId: UserId;
  userRole: MobileRole;
  userName: string;
  cityId: CityId;
  rideId: string | null;
  category: 'ride' | 'payment' | 'safety' | 'account' | 'wallet' | 'other';
  subject: string;
  status: SupportStatus;
  isDispute: boolean;
  messages: SupportMessage[];
  resolution: { outcome: string; note: string; by: string; at: IsoUtc; decision?: 'resolved' | 'rejected' } | null;
  /** Every step of the case: opening, replies, status changes, admin actions, decision. */
  history?: TicketHistoryEntry[];
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export type TicketHistoryKind = 'opened' | 'user_reply' | 'agent_reply' | 'info_requested' | 'status' | 'action' | 'internal_note' | 'decision';

export interface TicketHistoryEntry {
  at: IsoUtc;
  by: string;
  byType: 'user' | 'admin' | 'system';
  kind: TicketHistoryKind;
  label: string;
  note?: string;
  from?: SupportStatus;
  to?: SupportStatus;
}

export interface AuditActor {
  type: 'admin' | 'user' | 'system' | 'provider';
  id: string;
  name: string;
}

export interface AuditEvent {
  id: string;
  seq: number;
  at: IsoUtc;
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId: string;
  cityId: CityId | null;
  reason: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  /** Hash chain: each event commits to the previous one, making edits detectable. */
  prevHash: string;
  hash: string;
}

export interface Upload {
  id: UploadId;
  ownerId: UserId;
  purpose: VerificationItemKey | 'support_attachment';
  mimeType: string;
  width: number | null;
  height: number | null;
  size: number;
  createdAt: IsoUtc;
}
