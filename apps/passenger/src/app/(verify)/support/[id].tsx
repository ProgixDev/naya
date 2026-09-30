import { router, useLocalSearchParams } from 'expo-router';
import { TicketThreadScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

export default function VerifyTicket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketThreadScreen accountId={useAccountId()} ticketId={id} onBack={() => router.back()} />;
}
