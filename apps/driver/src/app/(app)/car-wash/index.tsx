import { router } from 'expo-router';
import { CarWashOrdersScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** « Lavage à domicile » for the driver's Naya car · orders. Entry: Compte (R7: the cross-sell left the dashboard). */
export default function CarWashOrders() {
  const a = useAccountId();
  return <CarWashOrdersScreen accountId={a} onBack={() => router.back()} onNew={() => router.push('/car-wash/new')} onOpen={(id) => router.push({ pathname: '/car-wash/[id]', params: { id } })} />;
}
