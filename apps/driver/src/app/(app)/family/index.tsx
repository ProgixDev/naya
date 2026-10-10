import { router } from 'expo-router';
import { FamilyDriverScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';

export default function Family() {
  const me = useMe();
  return <FamilyDriverScreen accountId={me.data?.user.id ?? 'driver'} onBack={() => router.back()} onOpenTrip={(id) => router.push({ pathname: '/family/[id]', params: { id } })} />;
}
