import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { OtpScreen } from '@naya/ui';
import { useSession } from '@/lib/session';

export default function Otp() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  if (!phone) return <Redirect href="/(auth)/phone" />;
  return <OtpScreen role="driver" phone={phone} onBack={() => router.back()} onVerified={(token, accountId) => useSession.getState().signIn(token, accountId)} />;
}
