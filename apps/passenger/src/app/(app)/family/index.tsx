import { router } from 'expo-router';
import { FamilleScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

export default function Family() {
  const a = useAccountId();
  return (
    <FamilleScreen
      accountId={a}
      role="passenger"
      onBack={() => router.back()}
      onOpenTrip={(id) => router.push({ pathname: '/family/[id]', params: { id } })}
      onOpenPlans={() => router.push('/family/plans')}
    />
  );
}
