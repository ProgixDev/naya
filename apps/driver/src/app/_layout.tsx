import { useStackMotion } from '@naya/ui';
import '../../global.css';
import '@/lib/backgroundLocation';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { AppProviders, DevNavigator, ErrorState } from '@naya/ui';
import { colors } from '@naya/tokens';
import { useSession } from '@/lib/session';
import { isSubmitted, useCases } from '@/lib/queries';

export { ErrorBoundary } from 'expo-router';

function RootNavigator() {
  const stackMotion = useStackMotion();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const { person, vehicle, isLoading, isError, data, refetch } = useCases();
  // The navigator stays mounted while the account loads so a deep link (e.g. /wallet) is kept;
  // an opaque cover hides the screen until the guards below are settled.
  const loading = signedIn && isLoading;
  const failed = signedIn && isError && !data;
  // The dashboard opens once both dossiers were sent. Going online still needs both approvals.
  const submitted = isSubmitted(person) && isSubmitted(vehicle);
  return (
    <>
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !loading && !submitted}>
        <Stack.Screen name="(onboard)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && (loading || submitted)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="docs" />
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
      <DevNavigator app="driver" session={useSession} />
    </AppProviders>
  );
}
