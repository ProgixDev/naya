import '../../global.css';
import { Stack } from 'expo-router';
import { AppProviders, DevNavigator, ErrorState } from '@naya/ui';
import { View } from 'react-native';
import { colors } from '@naya/tokens';
import { useSession } from '@/lib/session';
import { useIdentityCase } from '@/lib/queries';

export { ErrorBoundary } from 'expo-router';

function RootNavigator() {
  const status = useSession((s) => s.status);
  const signedIn = status === 'signedIn';
  const { identity, isLoading, isError, refetch } = useIdentityCase();
  const verified = identity?.status === 'approved';
  if (signedIn && isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (signedIn && isError && !identity) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ErrorState onRetry={() => refetch()} /></View>;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !verified}>
        <Stack.Screen name="(verify)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && verified}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="dev" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders session={useSession}>
      <RootNavigator />
      <DevNavigator app="passenger" session={useSession} />
    </AppProviders>
  );
}
