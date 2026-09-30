import { router } from 'expo-router';
import { DevLauncher } from '@naya/ui';
import { useSession } from '@/lib/session';

export default function Dev() {
  return (
    <DevLauncher
      role="passenger"
      onBack={() => router.back()}
      onSignInAs={async (phone) => {
        await useSession.getState().signOut();
        router.replace({ pathname: '/(auth)/phone', params: { phone } });
      }}
    />
  );
}
