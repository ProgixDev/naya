import { router } from 'expo-router';
import { FamilyPlanTripScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';

export default function FamilyPlanTrip() {
  const me = useMe();
  const cityId = usePrefs((s) => s.cityId);
  return <FamilyPlanTripScreen accountId={me.data?.user.id ?? 'passenger'} cityId={me.data?.user.cityId ?? cityId} onBack={() => router.back()} onDone={() => router.back()} />;
}
