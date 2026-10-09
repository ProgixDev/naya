import {
  type PrototypeCatalog, type FamilyOverview, type FamilySubscription, type FamilyChild, type FamilyTrip, type FamilyTripKind, type PassengerWallet, type SafetyAlert, type SafetyActionCode, type DisputeReason, type TicketActionInput, type PrototypeAdmin,
  ERROR_MESSAGES,
  type AdminUser,
  type AuditEvent,
  type CancelInput,
  type CancellationPreview,
  type CityConfig,
  type CityRules,
  type CityRulesVersion,
  type CityStatusInput,
  type CorrectionInput,
  type CreateCityInput,
  type DecisionInput,
  type DriverOffer,
  type EarningsSummary,
  type ErrorCode,
  type IdentityDetailsInput,
  type LatLng,
  type LedgerEntry,
  type MobileRole,
  type Payment,
  type PaymentMethod,
  type PaymentProviderConfig,
  type ProviderOption,
  type ProviderCreateInput,
  type ProviderSettingsInput,
  type ProviderFlow,
  type ProviderKind,
  type PaymentPurpose,
  type PayoutAccount,
  type Place,
  type ProfileUpdate,
  type ProviderToggleInput,
  type Quote,
  type Recharge,
  type ResolveTicketInput,
  type Ride,
  type SavedPlaceInput,
  type ScheduledBooking,
  type ServiceZone,
  type SupportMessageInput,
  type SupportTicket,
  type SupportTicketInput,
  type Upload,
  type UploadInput,
  type UpdateRulesInput,
  type User,
  type Vehicle,
  type VehicleDetailsInput,
  type VerificationCase,
  type VerificationItemKey,
  type Wallet,
  type Withdrawal,
  type ZoneInput,
  type CancellationPolicy,
  type BasisPoints,
  type Centimes,
  type CityStatus,
} from '@naya/domain';

/* ───────────── Response contracts ───────────── */

export interface PublicCity {
  id: string;
  name: string;
  status: CityStatus;
  center: LatLng;
  rulesVersion: number;
  zones: ServiceZone[];
  cancellation: CancellationPolicy;
  dynamic: { multiplierBp: BasisPoints; reason: string } | null;
  scheduling: CityRules['scheduling'];
  offerTimeoutSeconds: number;
  debtLimit: Centimes;
  commissionBp: BasisPoints;
  minimumWithdrawal: Centimes;
}

export interface MeResponse {
  user: User;
  cases: VerificationCase[];
  vehicle: Vehicle | null;
  city: PublicCity;
  recoverableRejections: string[];
}

export interface OtpRequestResponse {
  expiresAt: string;
  resendAvailableAt: string;
  demoCode: string | null;
  delivery: 'demo' | 'console' | 'sms';
}

export interface AuthProviders {
  phone: boolean;
  apple: boolean;
  google: boolean;
}

export type EligibilityReason =
  | { code: 'identity_not_approved'; status: string }
  | { code: 'vehicle_not_approved'; status: string }
  | { code: 'debt_limit'; balance: Centimes; limit: Centimes }
  | { code: 'city_unavailable'; cityId: string }
  | { code: 'account_suspended' };

export interface DriverStatus {
  online: boolean;
  presence: { online: boolean; location: LatLng | null; locationAt: string | null; bot: boolean } | null;
  eligibility: { eligible: boolean; reasons: EligibilityReason[] };
  wallet: Wallet;
  offer: DriverOffer | null;
  activeRide: Ride | null;
  awaitingCashRide: Ride | null;
  city: PublicCity;
}

export interface WalletResponse {
  wallet: Wallet;
  pendingWithdrawals: Withdrawal[];
  pendingRecharges: Recharge[];
  payoutAccounts: PayoutAccount[];
  city: PublicCity;
}

export interface Page<T> {
  items: T[];
  nextCursor: number | null;
  total: number;
}

export type ClientPaymentMethod = Omit<PaymentMethod, 'providerToken'> & { availableInCity: boolean };

export interface RideDetail {
  ride: Ride;
  payments: Payment[];
}

export interface LedgerDetail {
  entry: LedgerEntry;
  ride: Ride | null;
  recharge: Recharge | null;
  withdrawal: Withdrawal | null;
}

export interface AdminOverview {
  cityId: string;
  completedRides: number;
  volume: Centimes;
  commission: Centimes;
  byMethod: { cash: Centimes; card: Centimes; wallet: Centimes; mobile_wallet: Centimes };
  activeRides: number;
  reviewQueue: { caseId: string; subject: VerificationCase['subject']; userId: string; userName: string; submittedAt: string | null }[];
  openTickets: number;
  pendingTransfers: number;
  failedPayments: number;
  onlineDrivers: { driverId: string; name: string; location: LatLng | null; bot: boolean }[];
  recentRides: Ride[];
}

export interface AdminPersonRow {
  user: User;
  identityStatus: VerificationCase['status'];
  vehicleStatus: VerificationCase['status'] | null;
  vehicle: Vehicle | null;
  wallet: Wallet | null;
}

export interface AdminPersonDetail {
  user: User;
  cases: VerificationCase[];
  vehicle: Vehicle | null;
  rides: Ride[];
  wallet: Wallet | null;
  ledger: LedgerEntry[];
  tickets: SupportTicket[];
  presence: DriverStatus['presence'];
  eligibility: DriverStatus['eligibility'] | null;
  audit: AuditEvent[];
}

export interface AdminCaseDetail {
  case: VerificationCase;
  user: User;
  related: VerificationCase[];
  vehicle: Vehicle | null;
  audit: AuditEvent[];
  rejectionReasons: { code: string; label: string }[];
  canDecide: boolean;
}

export interface AdminRideRow {
  ride: Ride;
  payment: Payment | null;
  passengerName: string;
  driverName: string | null;
}

export interface AdminRideDetail {
  ride: Ride;
  offers: (DriverOffer & { driverName: string })[];
  payments: Payment[];
  ledger: LedgerEntry[];
  tickets: SupportTicket[];
  audit: AuditEvent[];
  passenger: User;
  driver: User | null;
}

export interface AdminFinanceSummary {
  cityId: string;
  drivers: { driver: User; wallet: Wallet }[];
  totals: { balances: Centimes; reserved: Centimes; debt: Centimes; blocked: number };
  recharges: Recharge[];
  withdrawals: Withdrawal[];
  failedPayments: Payment[];
  pendingPayments: Payment[];
  payments: Payment[];
  commissions: { total: Centimes; gross: Centimes; byService: { id: string; name: string; rides: number; gross: Centimes; commission: Centimes }[] };
  passengerWallets: { passenger: { id: string; name: string }; wallet: PassengerWallet }[];
}

/** An implementation in the server's adapter registry. */
export interface PaymentAdapterInfo {
  id: string;
  name: string;
  description: string;
  mode: 'demo' | 'live';
  kinds: ProviderKind[];
  purposes: PaymentPurpose[];
  flow: ProviderFlow;
  needsPhone: boolean;
  configured: boolean;
}

export interface TicketPerson {
  id: string;
  name: string;
  phone: string;
}

export interface AdminCityRow {
  city: CityConfig;
  zones: ServiceZone[];
  versions: CityRulesVersion[];
  providers: PaymentProviderConfig[];
}

export interface DevScenarios {
  scenarios: Record<string, string>;
  accounts: {
    passengers: { phone: string; name: string; state: string }[];
    drivers: { phone: string; name: string; state: string }[];
    admins: { email: string; password: string; name: string; role: string }[];
    otp: string;
  };
  current: string;
}

/* ───────────── Errors ───────────── */

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** Field errors from Zod validation, keyed by path. */
  get fields(): Record<string, string> {
    return (this.details?.fields as Record<string, string>) ?? {};
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  return ERROR_MESSAGES.UNKNOWN;
}

/* ───────────── Client ───────────── */

export interface ClientOptions {
  baseUrl: string;
  getToken: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
  timeoutMs?: number;
  transport?: (url: string, init: RequestInit) => Promise<Response>;
  uploadUrl?: (id: string) => string;
}

export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Tracks the difference between server and device clocks so countdowns are computed
 * against the server's authoritative deadlines even when the phone clock is wrong.
 */
export const serverClock = {
  skewMs: 0,
  now() {
    return Date.now() + this.skewMs;
  },
  observe(serverIso: string | null, sentAt: number, receivedAt: number) {
    if (!serverIso) return;
    const server = Date.parse(serverIso);
    if (Number.isNaN(server)) return;
    const midpoint = sentAt + (receivedAt - sentAt) / 2;
    this.skewMs = Math.round(server - midpoint);
  },
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function createApiClient(opts: ClientOptions) {
  const base = opts.baseUrl.replace(/\/$/, '');

  async function request<T>(method: Method, path: string, body?: unknown, extra: { idempotencyKey?: string } = {}): Promise<T> {
    const token = await opts.getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (extra.idempotencyKey) headers['Idempotency-Key'] = extra.idempotencyKey;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000) : null;
    const sentAt = Date.now();
    let res: Response;
    try {
      res = await (opts.transport ?? fetch)(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller?.signal });
    } catch (error) {
      if (opts.transport) throw error;
      throw new ApiError('NETWORK', ERROR_MESSAGES.NETWORK, 0);
    } finally {
      if (timer) clearTimeout(timer);
    }
    serverClock.observe(res.headers.get('X-Server-Time'), sentAt, Date.now());
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const err = (json as { error?: { code: ErrorCode; message: string; details: Record<string, unknown> | null } } | null)?.error;
      if (res.status === 401 && err?.code === 'UNAUTHORIZED') opts.onUnauthorized?.();
      throw new ApiError(err?.code ?? 'UNKNOWN', err?.message ?? ERROR_MESSAGES.UNKNOWN, res.status, err?.details ?? null);
    }
    return json as T;
  }

  const get = <T>(p: string) => request<T>('GET', p);
  const post = <T>(p: string, b?: unknown, key?: string) => request<T>('POST', p, b ?? {}, { idempotencyKey: key });
  const qs = (o: Record<string, string | number | undefined | null | boolean>) => {
    const e = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return e.length ? `?${e.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
  };

  return {
    baseUrl: base,
    uploadPreview: (id: string) => get<{ uri: string; mimeType: string }>(`/uploads/${id}/preview`),
    uploadUrl: (id: string) => opts.uploadUrl?.(id) ?? `${base}/uploads/${id}`,
    health: () => get<{ ok: boolean; version: number; scenario: string; devMode: boolean; time: string }>('/health'),
    sync: () => get<{ version: number; time: string }>('/sync'),

    auth: {
      providers: () => get<AuthProviders>('/auth/providers'),
      requestOtp: (phone: string, role: MobileRole) => post<OtpRequestResponse>('/auth/otp/request', { phone, role }),
      verifyOtp: (phone: string, role: MobileRole, code: string) => post<{ token: string; isNew: boolean; user: User }>('/auth/otp/verify', { phone, role, code }),
      logout: () => post<{ ok: true }>('/auth/logout'),
    },

    me: {
      get: () => get<MeResponse>('/me'),
      update: (input: ProfileUpdate) => request<User>('PATCH', '/me', input),
      addPlace: (input: SavedPlaceInput) => post<User>('/me/places', input),
      removePlace: (id: string) => request<User>('DELETE', `/me/places/${id}`),
    },

    uploads: {
      create: (input: UploadInput) => post<Upload>('/uploads', input),
    },

    verification: {
      list: () => get<{ cases: VerificationCase[]; rejectionReasons: { code: string; label: string }[]; recoverableRejections: string[] }>('/verification'),
      ensureVehicleCase: () => post<VerificationCase>('/verification/vehicle'),
      saveIdentity: (caseId: string, input: IdentityDetailsInput) => request<VerificationCase>('PUT', `/verification/${caseId}/identity`, input),
      saveVehicle: (caseId: string, input: VehicleDetailsInput) => request<VerificationCase>('PUT', `/verification/${caseId}/vehicle`, input),
      setItem: (caseId: string, key: VerificationItemKey, uploadIds: string[]) => request<VerificationCase>('PUT', `/verification/${caseId}/items/${key}`, { uploadIds }),
      submit: (caseId: string) => post<VerificationCase>(`/verification/${caseId}/submit`),
      reopen: (caseId: string) => post<VerificationCase>(`/verification/${caseId}/reopen`),
    },

    cities: {
      list: () => get<PublicCity[]>('/cities'),
    },

    places: {
      search: (q: string, cityId: string) => get<Place[]>(`/places/search${qs({ q, cityId })}`),
      reverse: (p: LatLng) => get<Place>(`/places/reverse${qs({ lat: p.lat, lng: p.lng })}`),
    },

    quotes: {
      create: (cityId: string, stops: Place[], categoryId?: string) => post<Quote>('/quotes', { cityId, stops, categoryId }),
    },

    paymentMethods: {
      list: () => get<ClientPaymentMethod[]>('/payment-methods'),
      addCard: (providerToken: string, makeDefault: boolean) => post<ClientPaymentMethod>('/payment-methods/card', { providerToken, makeDefault }),
      setDefault: (id: string) => post<{ ok: true }>(`/payment-methods/${id}/default`),
      remove: (id: string) => request<{ ok: true }>('DELETE', `/payment-methods/${id}`),
    },

    rides: {
      create: (quoteId: string, paymentMethodId: string, key: string) => post<Ride>('/rides', { quoteId, paymentMethodId }, key),
      active: () => get<Ride | null>('/rides/active'),
      history: (cursor = 0, limit = 20) => get<Page<Ride>>(`/rides${qs({ cursor, limit })}`),
      get: (id: string) => get<RideDetail>(`/rides/${id}`),
      cancellationPreview: (id: string) => get<CancellationPreview>(`/rides/${id}/cancellation-preview`),
      cancel: (id: string, input: CancelInput, key: string) => post<Ride>(`/rides/${id}/cancel`, input, key),
      retrySearch: (id: string) => post<Ride>(`/rides/${id}/retry-search`),
      rate: (id: string, stars: number, comment: string | null) => post<Ride>(`/rides/${id}/rating`, { stars, comment }),
      retryPayment: (id: string, paymentMethodId: string, key: string) => post<Ride>(`/rides/${id}/payment/retry`, { paymentMethodId }, key),
    },

    scheduled: {
      create: (quoteId: string, paymentMethodId: string, pickupAt: string, key: string) => post<ScheduledBooking>('/scheduled', { quoteId, paymentMethodId, pickupAt }, key),
      list: () => get<ScheduledBooking[]>('/scheduled'),
      get: (id: string) => get<ScheduledBooking>(`/scheduled/${id}`),
      modify: (id: string, pickupAt: string, paymentMethodId?: string) => request<ScheduledBooking>('PATCH', `/scheduled/${id}`, { pickupAt, paymentMethodId }),
      cancel: (id: string, reasonCode: string, reasonText?: string) => post<ScheduledBooking>(`/scheduled/${id}/cancel`, { reasonCode, reasonText }),
    },

    driver: {
      status: () => get<DriverStatus>('/driver/status'),
      setOnline: (online: boolean, location: LatLng | null) => post<DriverStatus>('/driver/online', { online, location }),
      sendLocation: (location: LatLng) => post<{ ok: true }>('/driver/location', { location }),
      acceptOffer: (offerId: string, key: string) => post<Ride>(`/driver/offers/${offerId}/accept`, {}, key),
      declineOffer: (offerId: string, reasonCode: string) => post<DriverOffer>(`/driver/offers/${offerId}/decline`, { reasonCode }),
      arrive: (rideId: string) => post<Ride>(`/driver/rides/${rideId}/arrive`),
      start: (rideId: string) => post<Ride>(`/driver/rides/${rideId}/start`),
      completeStop: (rideId: string) => post<Ride>(`/driver/rides/${rideId}/stop-complete`),
      complete: (rideId: string) => post<Ride>(`/driver/rides/${rideId}/complete`),
      cashCollected: (rideId: string, amount: Centimes) => post<Ride>(`/driver/rides/${rideId}/cash-collected`, { amount }),
      cancelRide: (rideId: string, reasonCode: string, reasonText?: string) => post<Ride>(`/driver/rides/${rideId}/cancel`, { reasonCode, reasonText }),
      earnings: (from?: string | null, to?: string | null) => get<EarningsSummary>(`/driver/earnings${qs({ from, to })}`),
      wallet: () => get<WalletResponse>('/driver/wallet'),
      ledger: (type?: string, cursor = 0, limit = 30) => get<Page<LedgerEntry>>(`/driver/ledger${qs({ type, cursor, limit })}`),
      ledgerEntry: (id: string) => get<LedgerDetail>(`/driver/ledger/${id}`),
      transfers: () => get<{ recharges: Recharge[]; withdrawals: Withdrawal[] }>('/driver/transfers'),
      providers: (purpose: 'recharge' | 'withdrawal') => get<ProviderOption[]>(`/payment-providers${qs({ purpose })}`),
      recharge: (amount: Centimes, providerId: string, key: string, payerPhone?: string) => post<Recharge>('/driver/recharges', { amount, providerId, ...(payerPhone ? { payerPhone } : {}) }, key),
      getRecharge: (id: string) => get<Recharge>(`/driver/recharges/${id}`),
      withdraw: (amount: Centimes, payoutAccountId: string, key: string) => post<Withdrawal>('/driver/withdrawals', { amount, payoutAccountId }, key),
      getWithdrawal: (id: string) => get<Withdrawal>(`/driver/withdrawals/${id}`),
    },

    /** Stands in for the provider's hosted checkout / card fields. Demo only. */
    providerSandbox: {
      resolve: (kind: 'recharge' | 'payment', ref: string, outcome: 'approve' | 'decline') => post<{ outcome: string }>(`/provider-sandbox/${kind}/${ref}/${outcome}`),
      tokenize: (last4: string) => post<{ providerToken: string }>('/provider-sandbox/tokenize', { last4 }),
    },

    support: {
      list: () => get<SupportTicket[]>('/support/tickets'),
      get: (id: string) => get<SupportTicket>(`/support/tickets/${id}`),
      create: (input: SupportTicketInput) => post<SupportTicket>('/support/tickets', input),
      message: (id: string, input: SupportMessageInput) => post<SupportTicket>(`/support/tickets/${id}/messages`, input),
    },

    prototype: {
      catalog: () => get<PrototypeCatalog>('/prototype/catalog'),
      wallet: () => get<PassengerWallet>('/prototype/wallet'),
      topup: (amount: number, providerId: string, key: string, payerPhone?: string) => post<PassengerWallet['entries'][number]>('/prototype/wallet/topup', { amount, providerId, ...(payerPhone ? { payerPhone } : {}) }, key),
      /** Recharge options of the person's city (same providers as drivers, filtered by audience). */
      rechargeProviders: () => get<ProviderOption[]>(`/payment-providers${qs({ purpose: 'recharge' })}`),
      resolveTopup: (id: string, outcome: 'confirmed' | 'failed') => post<PassengerWallet>(`/prototype/wallet/${id}/resolve`, { outcome }),
      family: () => get<FamilyOverview>('/prototype/family'),
      example: () => post<FamilyOverview>('/prototype/family/example'),
      child: (input: Omit<FamilyChild, 'id' | 'passengerId'>) => post<FamilyChild>('/prototype/family/children', input),
      updateChild: (id: string, input: Omit<FamilyChild, 'id' | 'passengerId'>) => request<FamilyChild>('PUT', `/prototype/family/children/${id}`, input),
      subscribe: (planId: string, key: string) => post<FamilySubscription>('/prototype/family/subscribe', { planId }, key),
      trip: (input: { childId: string; pickup: Place; destination: Place; pickupAt: string; weekdays: number[]; kind?: FamilyTripKind }, key: string) => post<FamilyTrip>('/prototype/family/trips', input, key),
      advance: (id: string, input: { expectedStatus: string; proof?: string; childName?: string; recipientId?: string; code?: string }) => post<FamilyTrip>(`/prototype/family/trips/${id}/advance`, input),
      incident: (id: string, message: string) => post<FamilyTrip>(`/prototype/family/trips/${id}/incident`, { message }),
      stop: (id: string, stopped: boolean) => post<FamilyTrip>(`/prototype/family/trips/${id}/stop`, { stopped }),
      sos: (input: { rideId: string | null; familyTripId: string | null; location: LatLng; contactName: string; contactPhone?: string | null; note?: string | null }, key: string) => post<SafetyAlert>('/prototype/sos', input, key),
      alerts: () => get<SafetyAlert[]>('/prototype/sos'),
      safetyAction: (id: string, action: SafetyActionCode) => post<SafetyAlert>(`/prototype/sos/${id}/action`, { action }),
    },
    adminPrototype: {
      get: () => get<PrototypeAdmin>('/admin/prototype'),
      save: (kind: 'categories' | 'plans' | 'reasons' | 'payments', input: unknown) => request<PrototypeCatalog>('PUT', `/admin/prototype/catalog/${kind}`, input),
      alert: (id: string, status: SafetyAlert['status'], note: string) => post<SafetyAlert>(`/admin/prototype/alerts/${id}`, { status, note }),
      assign: (id: string, driverId: string) => post(`/admin/prototype/assignment/${id}`, { driverId }),
      categories: (id: string, categoryIds: string[]) => post(`/admin/prototype/driver-categories/${id}`, { categoryIds }),
      subscriptionStatus: (id: string, status: FamilySubscription['status'], reason: string) => post<FamilySubscription>(`/admin/prototype/subscriptions/${id}/status`, { status, reason }),
      familyAvailability: (driverId: string, available: boolean) => post(`/admin/prototype/family-availability/${driverId}`, { available }),
    },
    admin: {
      login: (email: string, password: string) => post<{ token: string; admin: AdminUser }>('/admin/auth/login', { email, password }),
      me: () => get<AdminUser>('/admin/me'),
      overview: (cityId: string, period: string) => get<AdminOverview>(`/admin/overview${qs({ cityId, period })}`),
      people: (p: { q?: string; role?: string; cityId?: string; verification?: string; cursor?: number; limit?: number }) => get<Page<AdminPersonRow>>(`/admin/people${qs(p)}`),
      person: (id: string) => get<AdminPersonDetail>(`/admin/people/${id}`),
      verifications: (p: { status?: string; subject?: string; cityId?: string; cursor?: number }) => get<Page<{ case: VerificationCase; user: User }>>(`/admin/verifications${qs(p)}`),
      verification: (id: string) => get<AdminCaseDetail>(`/admin/verifications/${id}`),
      startReview: (id: string) => post<VerificationCase>(`/admin/verifications/${id}/start-review`),
      decide: (id: string, input: DecisionInput) => post<VerificationCase>(`/admin/verifications/${id}/decision`, input),
      rides: (p: { q?: string; status?: string; cityId?: string; method?: string; sort?: string; cursor?: number; limit?: number }) => get<Page<AdminRideRow>>(`/admin/rides${qs(p)}`),
      scheduled: (cityId?: string) => get<{ booking: ScheduledBooking; passengerName: string }[]>(`/admin/scheduled${qs({ cityId })}`),
      ride: (id: string) => get<AdminRideDetail>(`/admin/rides/${id}`),
      tickets: (p: { status?: string; cityId?: string; disputes?: boolean; cursor?: number }) => get<Page<SupportTicket>>(`/admin/support${qs({ ...p, disputes: p.disputes ? 1 : undefined })}`),
      ticket: (id: string) => get<{ ticket: SupportTicket; reason: DisputeReason | null; passenger: TicketPerson | null; driver: TicketPerson | null; ride: Ride | null; payments: Payment[]; audit: AuditEvent[] }>(`/admin/support/${id}`),
      replyTicket: (id: string, body: string, requestInfo = true) => post<SupportTicket>(`/admin/support/${id}/messages`, { body, attachments: [], requestInfo }),
      startAnalysis: (id: string, note?: string) => post<SupportTicket>(`/admin/support/${id}/status`, { status: 'in_progress', note }),
      ticketAction: (id: string, input: TicketActionInput) => post<SupportTicket>(`/admin/support/${id}/actions`, input),
      resolveTicket: (id: string, input: ResolveTicketInput) => post<SupportTicket>(`/admin/support/${id}/resolve`, input),
      financeSummary: (cityId: string) => get<AdminFinanceSummary>(`/admin/finance/summary${qs({ cityId })}`),
      ledger: (p: { driverId?: string; type?: string; cityId?: string; cursor?: number; limit?: number }) => get<Page<{ entry: LedgerEntry; driverName: string }>>(`/admin/finance/ledger${qs(p)}`),
      correction: (input: CorrectionInput, key: string) => post<LedgerEntry>('/admin/finance/corrections', input, key),
      cities: () => get<AdminCityRow[]>('/admin/cities'),
      createCity: (input: CreateCityInput) => post<CityConfig>('/admin/cities', input),
      updateRules: (cityId: string, input: UpdateRulesInput) => request<CityConfig>('PUT', `/admin/cities/${cityId}/rules`, input),
      setCityStatus: (cityId: string, input: CityStatusInput) => post<CityConfig>(`/admin/cities/${cityId}/status`, input),
      addZone: (cityId: string, input: ZoneInput) => post<ServiceZone>(`/admin/cities/${cityId}/zones`, input),
      setZoneActive: (zoneId: string, active: boolean, reason: string) => post<ServiceZone>(`/admin/zones/${zoneId}/active`, { active, reason }),
      providers: (cityId?: string) => get<(ProviderOption & { adapterName: string })[]>(`/admin/providers${qs({ cityId })}`),
      paymentAdapters: () => get<PaymentAdapterInfo[]>('/admin/payment-adapters'),
      createProvider: (input: ProviderCreateInput) => post<PaymentProviderConfig>('/admin/providers', input),
      updateProvider: (id: string, input: ProviderSettingsInput) => request<PaymentProviderConfig>('PUT', `/admin/providers/${id}`, input),
      toggleProvider: (id: string, input: ProviderToggleInput) => post<PaymentProviderConfig>(`/admin/providers/${id}`, input),
      audit: (p: { q?: string; action?: string; cityId?: string; actorType?: string; cursor?: number; limit?: number }) => get<Page<AuditEvent> & { integrity: { valid: boolean; brokenAt: number | null } }>(`/admin/audit${qs(p)}`),
    },

    /** Development-only scenario launcher (404 when the API runs with NAYA_DEV=0). */
    dev: {
      scenarios: () => get<DevScenarios>('/dev/scenarios'),
      reset: (scenario: string) => post<{ ok: true; scenario: string }>('/dev/reset', { scenario }),
      advanceClock: (seconds: number) => post<{ time: string }>('/dev/clock/advance', { seconds }),
      setBot: (online: boolean) => post<unknown>('/dev/bot', { online }),
      freezeTracking: (rideId: string) => post<unknown>(`/dev/tracking/${rideId}/freeze`),
      resumeTracking: (rideId: string) => post<unknown>(`/dev/tracking/${rideId}/resume`),
      resolveProvider: (kind: 'payment' | 'recharge' | 'withdrawal', ref: string, outcome: 'confirm' | 'fail') => post<unknown>(`/dev/providers/${kind}/${ref}/${outcome}`),
      /** Attaches a fictional specimen as the caller's upload (capture bypass without a camera). */
      sampleUpload: (purpose: VerificationItemKey) => post<Upload>('/dev/sample-upload', { purpose }),
      providerJobs: () => get<{ id: string; kind: string; ref: string; outcome: string; dueAt: string | null }[]>('/dev/provider-jobs'),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
