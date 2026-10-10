import { router } from 'expo-router';
import { FamilyPlansScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';

export default function FamilyPlans() {
  const me = useMe();
  return <FamilyPlansScreen accountId={me.data?.user.id ?? 'passenger'} onBack={() => router.back()} onDone={() => router.back()} />;
}
