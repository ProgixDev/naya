import { router, useLocalSearchParams } from 'expo-router';
import { FamilleTripScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

export default function FamilyTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = useAccountId();
  return <FamilleTripScreen id={id} accountId={a} role="passenger" onBack={() => (router.canGoBack() ? router.back() : router.replace('/family'))} />;
}
