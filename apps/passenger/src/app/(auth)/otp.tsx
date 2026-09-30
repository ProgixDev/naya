import { router, useLocalSearchParams } from 'expo-router';
import { OtpScreen } from '@naya/ui';
import { useSession } from '@/lib/session';

export default function Otp() {
  const { phone, demoCode } = useLocalSearchParams<{ phone: string; demoCode?: string }>();
  return (
    <OtpScreen
      role="passenger"
      phone={phone}
      demoCode={demoCode || null}
      onBack={() => router.back()}
      onVerified={(token, accountId) => useSession.getState().signIn(token, accountId)}
    />
  );
}
