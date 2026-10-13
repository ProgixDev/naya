import { useQuery } from '@tanstack/react-query';
import { qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { FAMILY_LIVE_POLL_MS, isFamilyTripActive, type FamilyOverview, type FamilyTrip } from '@naya/domain';

/** Fast while a trip is running (approval requests must arrive quickly), slow otherwise. */
export function useFamily(accountId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: qk.family(accountId),
    queryFn: api.prototype.family,
    enabled,
    refetchInterval: (q) => ((q.state.data as FamilyOverview | undefined)?.trips.some((t) => isFamilyTripActive(t.status)) ? 2000 : 10_000),
  });
}

export function useFamilyTrip(accountId: string, id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: qk.familyTrip(accountId, id ?? ''),
    queryFn: () => api.prototype.familyTrip(id!),
    enabled: !!id,
    refetchInterval: (q) => ((q.state.data as FamilyTrip | undefined) && isFamilyTripActive((q.state.data as FamilyTrip).status) ? 2000 : 15_000),
  });
}

/** Live GPS of the chauffeuse, every second while the trip is active (ADR-0013 polling). */
export function useFamilyLive(accountId: string, trip: Pick<FamilyTrip, 'id' | 'status'> | undefined) {
  const api = useApi();
  const active = !!trip && isFamilyTripActive(trip.status);
  return useQuery({
    queryKey: qk.familyLive(accountId, trip?.id ?? ''),
    queryFn: () => api.prototype.familyLive(trip!.id),
    enabled: !!trip,
    refetchInterval: active ? FAMILY_LIVE_POLL_MS : false,
  });
}

export const activeFamilyTrip = (data: FamilyOverview | undefined) =>
  data?.trips.find((t) => t.status === 'awaiting_approval') ?? data?.trips.find((t) => isFamilyTripActive(t.status)) ?? null;

export const nextFamilyTrip = (data: FamilyOverview | undefined) => data?.trips.find((t) => t.status === 'scheduled') ?? null;
