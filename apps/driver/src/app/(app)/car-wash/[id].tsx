import { router, useLocalSearchParams } from 'expo-router';
import { CarWashOrderScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** « Lavage à domicile » · tracking, photos, receipt, rating and cancellation. */
export default function CarWashOrder() {
  const a = useAccountId();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CarWashOrderScreen accountId={a} orderId={id} onBack={() => (router.canGoBack() ? router.back() : router.replace('/car-wash'))} onHelp={() => router.push('/support/new')} />;
}
