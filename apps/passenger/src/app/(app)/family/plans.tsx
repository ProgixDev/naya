import { router } from 'expo-router';
import { FamillePlansScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

export default function FamilyPlans() {
  const a = useAccountId();
  return <FamillePlansScreen accountId={a} onBack={() => router.back()} onSubscribed={() => router.back()} />;
}
