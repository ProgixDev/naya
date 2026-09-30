import { router } from 'expo-router';
import { illustrations } from '@naya/assets';
import { TicketListScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** D18 · list */
export default function Support() {
  const a = useAccountId();
  return <TicketListScreen accountId={a} onBack={() => router.back()} onOpen={(id) => router.push({ pathname: '/support/[id]', params: { id } })} onCreate={() => router.push('/support/new')} emptyImage={illustrations.driverWallet} />;
}
