import { router, useLocalSearchParams } from 'expo-router';
import { TicketThreadScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

export default function Ticket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketThreadScreen accountId={useAccountId()} ticketId={id} onBack={() => (router.canGoBack() ? router.back() : router.replace('/support'))} />;
}
