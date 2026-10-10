import { router, useLocalSearchParams } from 'expo-router';
import { FamilyTripScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';

export default function FamilyTrip() {
  const me = useMe();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FamilyTripScreen accountId={me.data?.user.id ?? 'driver'} tripId={id} role="driver" onBack={() => router.back()} />;
}
