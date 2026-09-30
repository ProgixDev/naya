/**
 * Query keys are scoped by account so that switching accounts can never show another
 * person's cached data: clearing is `queryClient.removeQueries({ queryKey: ['naya'] })`.
 */
export const qk = {
  root: ['naya'] as const,
  account: (accountId: string) => ['naya', accountId] as const,
  me: (a: string) => ['naya', a, 'me'] as const,
  verification: (a: string) => ['naya', a, 'verification'] as const,
  cities: () => ['naya', 'public', 'cities'] as const,
  places: (q: string, cityId: string) => ['naya', 'public', 'places', cityId, q] as const,
  paymentMethods: (a: string) => ['naya', a, 'payment-methods'] as const,
  activeRide: (a: string) => ['naya', a, 'rides', 'active'] as const,
  ride: (a: string, id: string) => ['naya', a, 'rides', 'detail', id] as const,
  rideHistory: (a: string) => ['naya', a, 'rides', 'history'] as const,
  cancellationPreview: (a: string, id: string) => ['naya', a, 'rides', 'cancel-preview', id] as const,
  scheduled: (a: string) => ['naya', a, 'scheduled'] as const,
  scheduledOne: (a: string, id: string) => ['naya', a, 'scheduled', id] as const,
  driverStatus: (a: string) => ['naya', a, 'driver', 'status'] as const,
  earnings: (a: string, from: string | null, to: string | null) => ['naya', a, 'driver', 'earnings', from, to] as const,
  wallet: (a: string) => ['naya', a, 'driver', 'wallet'] as const,
  ledger: (a: string, type: string | undefined) => ['naya', a, 'driver', 'ledger', type ?? 'all'] as const,
  ledgerEntry: (a: string, id: string) => ['naya', a, 'driver', 'ledger-entry', id] as const,
  transfers: (a: string) => ['naya', a, 'driver', 'transfers'] as const,
  recharge: (a: string, id: string) => ['naya', a, 'driver', 'recharge', id] as const,
  withdrawal: (a: string, id: string) => ['naya', a, 'driver', 'withdrawal', id] as const,
  providers: (a: string, purpose: string) => ['naya', a, 'providers', purpose] as const,
  tickets: (a: string) => ['naya', a, 'support'] as const,
  ticket: (a: string, id: string) => ['naya', a, 'support', id] as const,
};

/** Bounded retries: never retry client errors (4xx), at most twice for network/server errors. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: number })?.status ?? 0;
  if (status >= 400 && status < 500) return false;
  return failureCount < 2;
}
