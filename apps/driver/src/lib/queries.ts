import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { VerificationCase } from '@naya/domain';
import { useSession } from './session';

export const useAccountId = () => useSession((s) => s.accountId) ?? 'anonymous';

export function useMe() {
  const api = useApi();
  const a = useAccountId();
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery({ queryKey: qk.me(a), queryFn: api.me.get, enabled: signedIn });
}

export function useCases() {
  const me = useMe();
  const person = me.data?.cases.find((c) => c.subject === 'driver_identity') ?? null;
  const vehicle = me.data?.cases.find((c) => c.subject === 'vehicle') ?? null;
  return { ...me, person, vehicle };
}

/** A case counts as submitted once it has left the draft state (even if sent back). */
export const isSubmitted = (c: VerificationCase | null) => !!c && c.status !== 'draft';

/**
 * Authoritative driver state: online flag, eligibility, wallet, current offer and active ride.
 * Polls quickly while something time-sensitive can happen (online or on a ride).
 */
export function useDriverStatus(enabled = true) {
  const api = useApi();
  const a = useAccountId();
  return useQuery({
    queryKey: qk.driverStatus(a),
    queryFn: api.driver.status,
    enabled,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 5000;
      return d.online || d.activeRide || d.offer?.status === 'pending' ? 1500 : 5000;
    },
  });
}

export function useWallet() {
  const api = useApi();
  const a = useAccountId();
  return useQuery({ queryKey: qk.wallet(a), queryFn: api.driver.wallet, refetchInterval: 4000 });
}
