import { router, useLocalSearchParams } from 'expo-router';
import { TicketCreateScreen } from '@naya/ui';
import type { SupportTicket } from '@naya/domain';
import { useAccountId } from '@/lib/queries';

export default function NewTicket() {
  const { rideId, category } = useLocalSearchParams<{ rideId?: string; category?: SupportTicket['category'] }>();
  return <TicketCreateScreen accountId={useAccountId()} rideId={rideId ?? null} defaultCategory={category ?? (rideId ? 'ride' : 'other')} role="passenger" onBack={() => router.back()} onCreated={(id) => router.replace({ pathname: '/support/[id]', params: { id } })} />;
}
