import type {
  AdminUser,
  AuditEvent,
  CityConfig,
  CityRulesVersion,
  DriverOffer,
  LedgerEntry,
  Payment,
  PaymentMethod,
  PaymentProviderConfig,
  PayoutAccount,
  Quote,
  Recharge,
  Ride,
  ScheduledBooking,
  ServiceZone,
  SupportTicket,
  Upload,
  User,
  Vehicle,
  VerificationCase,
  Withdrawal,
  LatLng,
} from '@naya/domain';

export interface DriverPresence {
  driverId: string;
  online: boolean;
  location: LatLng | null;
  locationAt: string | null;
  locationSource: 'demo' | 'gps';
  /** Development bot that plays another driver. Never used for the real driver app account. */
  bot: boolean;
  updatedAt: string;
}

export interface OtpChallenge {
  phone: string;
  role: 'passenger' | 'driver';
  codeHash: string;
  expiresAt: string;
  resendAvailableAt: string;
  attempts: number;
}

export interface Session {
  tokenHash: string;
  subjectType: 'user' | 'admin';
  subjectId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AdminCredential {
  adminId: string;
  passwordHash: string;
  salt: string;
}

export interface IdempotencyRecord {
  key: string;
  subjectId: string;
  route: string;
  bodyHash: string;
  status: number;
  response: unknown;
  at: string;
}

/** A simulated provider outcome, delivered later through the signed callback path. */
export interface ProviderJob {
  id: string;
  kind: 'payment' | 'recharge' | 'withdrawal' | 'passenger_recharge';
  ref: string;
  outcome: 'confirmed' | 'failed' | 'manual';
  reason: string | null;
  dueAt: string | null;
  delivered: boolean;
}

export interface TrackingOverride {
  rideId: string;
  frozenAt: string;
}

export interface State {
  prototype?: import('@naya/domain').PrototypeState;
  schemaVersion: 1;
  scenario: string;
  version: number;
  counters: Record<string, number>;
  users: User[];
  admins: AdminUser[];
  adminCredentials: AdminCredential[];
  sessions: Session[];
  otps: OtpChallenge[];
  cases: VerificationCase[];
  vehicles: Vehicle[];
  uploads: Upload[];
  cities: CityConfig[];
  cityRuleVersions: CityRulesVersion[];
  zones: ServiceZone[];
  providers: PaymentProviderConfig[];
  paymentMethods: PaymentMethod[];
  payoutAccounts: PayoutAccount[];
  quotes: Quote[];
  rides: Ride[];
  offers: DriverOffer[];
  scheduled: ScheduledBooking[];
  payments: Payment[];
  ledger: LedgerEntry[];
  recharges: Recharge[];
  withdrawals: Withdrawal[];
  tickets: SupportTicket[];
  audit: AuditEvent[];
  presence: DriverPresence[];
  idempotency: IdempotencyRecord[];
  providerJobs: ProviderJob[];
  processedProviderEvents: string[];
  tracking: TrackingOverride[];
}
