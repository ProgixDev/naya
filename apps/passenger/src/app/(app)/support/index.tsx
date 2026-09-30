import { router } from 'expo-router';
import { illustrations } from '@naya/assets';
import { TicketListScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

export default function SupportList() {
  return <TicketListScreen accountId={useAccountId()} onBack={() => router.back()} onOpen={(id) => router.push({ pathname: '/support/[id]', params: { id } })} onCreate={() => router.push('/support/new')} emptyImage={illustrations.passengerPlanning} />;
}
