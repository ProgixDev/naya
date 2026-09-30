import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
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
