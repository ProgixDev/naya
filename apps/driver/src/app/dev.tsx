import { Redirect, router } from 'expo-router';
import { DevLauncher } from '@naya/ui';
import { useSession } from '@/lib/session';

/**
 * Scenario launcher, for development builds only (__DEV__): reached by a 2 s long press on the
 * welcome logo or the deep link. Release builds (TestFlight, store) send the link home.
 */
export default function Dev() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <DevLauncher
      role="driver"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      onOpenBrand={() => router.push('/brand')}
      onSignInAs={async (phone) => {
        await useSession.getState().signOut();
        router.replace({ pathname: '/(auth)/phone', params: { phone } });
      }}
    />
  );
}
