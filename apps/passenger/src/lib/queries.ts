import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { isRideActive } from '@naya/domain';
import { useSession } from './session';

export const useAccountId = () => useSession((s) => s.accountId) ?? 'anonymous';

export function useMe() {
  const api = useApi();
  const a = useAccountId();
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery({ queryKey: qk.me(a), queryFn: api.me.get, enabled: signedIn });
}

export function useIdentityCase() {
  const me = useMe();
  return { ...me, identity: me.data?.cases.find((c) => c.subject === 'passenger_identity') ?? null };
}

export function useCities() {
  const api = useApi();
  return useQuery({ queryKey: qk.cities(), queryFn: api.cities.list, staleTime: 60_000 });
}

export function usePaymentMethods() {
  const api = useApi();
  const a = useAccountId();
  return useQuery({ queryKey: qk.paymentMethods(a), queryFn: api.paymentMethods.list });
}

/** Active ride, polled every 2 s while something is happening, every 15 s otherwise. */
export function useActiveRide() {
  const api = useApi();
  const a = useAccountId();
  return useQuery({
    queryKey: qk.activeRide(a),
    queryFn: api.rides.active,
    refetchInterval: (q) => {
      const r = q.state.data;
      return r && (isRideActive(r.status) || r.status === 'no_driver') ? 2000 : 15_000;
    },
  });
}

export function useRide(id: string | undefined, live = false) {
  const api = useApi();
  const a = useAccountId();
  return useQuery({ queryKey: qk.ride(a, id ?? ''), queryFn: () => api.rides.get(id!), enabled: !!id, refetchInterval: live ? 2500 : false });
}

export function useScheduled() {
  const api = useApi();
  const a = useAccountId();
  return useQuery({ queryKey: qk.scheduled(a), queryFn: api.scheduled.list });
}
