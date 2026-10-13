import { router, useLocalSearchParams } from 'expo-router';
import { FamilleTripScreen, useFamilyTrip } from '@naya/ui';
import { isFamilyTripActive } from '@naya/domain';
import { useApi } from '@naya/api/react';
import { useAccountId } from '@/lib/queries';
import { useLocationStream } from '@/lib/location';

export default function FamilyTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = useAccountId();
  const api = useApi();
  const trip = useFamilyTrip(a, id);
  // Real device: stream the position every second while the child's trip runs (standalone
  // demo builds use the simulated route instead).
  const moving = !!trip.data && (trip.data.status === 'en_route' || trip.data.status === 'in_progress') && isFamilyTripActive(trip.data.status);
  useLocationStream(moving, (p) => api.prototype.sendFamilyPosition(id, p).catch(() => undefined), { intervalMs: 1000 });
  return <FamilleTripScreen id={id} accountId={a} role="driver" onBack={() => (router.canGoBack() ? router.back() : router.replace('/family'))} />;
}
