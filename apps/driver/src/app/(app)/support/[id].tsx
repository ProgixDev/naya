import { router, useLocalSearchParams } from 'expo-router';
import { TicketThreadScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** D18-status · D18-reply */
export default function Ticket() {
  const a = useAccountId();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketThreadScreen accountId={a} ticketId={id} onBack={() => router.back()} />;
}
