import { router } from 'expo-router';
import { FamilyHubScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';

export default function Family() {
  const me = useMe();
  return (
    <FamilyHubScreen
      accountId={me.data?.user.id ?? 'passenger'}
      onBack={() => router.back()}
      nav={{
        plans: () => router.push('/family/plans'),
        child: (id) => router.push(id ? { pathname: '/family/child', params: { id } } : '/family/child'),
        planTrip: () => router.push('/family/plan-trip'),
        trip: (id) => router.push({ pathname: '/family/trip/[id]', params: { id } }),
      }}
    />
  );
}
