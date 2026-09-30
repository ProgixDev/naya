import { router, useLocalSearchParams } from 'expo-router';
import type { SupportTicket } from '@naya/domain';
import { TicketCreateScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** D18-form */
export default function NewTicket() {
  const a = useAccountId();
  const { rideId, category } = useLocalSearchParams<{ rideId?: string; category?: SupportTicket['category'] }>();
  return <TicketCreateScreen accountId={a} role="driver" rideId={rideId || null} defaultCategory={category ?? (rideId ? 'ride' : 'other')} onBack={() => router.back()} onCreated={(id) => router.replace({ pathname: '/support/[id]', params: { id } })} />;
}
