import { router } from 'expo-router';
import { TicketCreateScreen } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

export default function VerifySupport() {
  const a = useAccountId();
  return <TicketCreateScreen accountId={a} rideId={null} defaultCategory="account" role="passenger" onBack={() => router.back()} onCreated={(id) => router.replace({ pathname: '/(verify)/support/[id]', params: { id } })} />;
}
