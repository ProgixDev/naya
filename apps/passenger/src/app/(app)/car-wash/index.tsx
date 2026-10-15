import { router } from 'expo-router';
import { CarWashOrdersScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** « Lavage à domicile » · orders. Entry: the services rail on Home (R7). */
export default function CarWashOrders() {
  const a = useAccountId();
  return <CarWashOrdersScreen accountId={a} onBack={() => router.back()} onNew={() => router.push('/car-wash/new')} onOpen={(id) => router.push({ pathname: '/car-wash/[id]', params: { id } })} />;
}
