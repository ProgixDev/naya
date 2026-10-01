import { useStackMotion } from '@naya/ui';
import '../../global.css';
import { Stack } from 'expo-router';
import { AppProviders, DevNavigator, ErrorState } from '@naya/ui';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@naya/tokens';
import { useSession } from '@/lib/session';
import { useIdentityCase } from '@/lib/queries';

export { ErrorBoundary } from 'expo-router';

function RootNavigator() {
  const stackMotion = useStackMotion();
  const status = useSession((s) => s.status);
  const signedIn = status === 'signedIn';
  const { identity, isLoading, isError, refetch } = useIdentityCase();
  const verified = identity?.status === 'approved';
  // The navigator stays mounted while the account loads so deep links survive; an opaque
  // cover hides the screen until the verification guard is known.
  const loading = signedIn && isLoading;
  const failed = signedIn && isError && !identity;
  return (
    <>
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !loading && !verified}>
        <Stack.Screen name="(verify)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && (loading || verified)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="dev" options={{ presentation: 'modal' }} />
    </Stack>
    {loading || failed ? (
      <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', backgroundColor: colors.background }}>
        {failed ? <ErrorState onRetry={() => refetch()} /> : <ActivityIndicator color={colors.accent} accessibilityLabel="Chargement de votre espace" />}
      </View>
    ) : null}
    </>
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
