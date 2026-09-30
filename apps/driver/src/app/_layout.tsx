import '../../global.css';
import '@/lib/backgroundLocation';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AppProviders, DevNavigator, ErrorState } from '@naya/ui';
import { colors } from '@naya/tokens';
import { useSession } from '@/lib/session';
import { isSubmitted, useCases } from '@/lib/queries';

export { ErrorBoundary } from 'expo-router';

function RootNavigator() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const { person, vehicle, isLoading, isError, data, refetch } = useCases();
  if (signedIn && isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (signedIn && isError && !data)
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  // The dashboard opens once both dossiers were sent. Going online still needs both approvals.
  const submitted = isSubmitted(person) && isSubmitted(vehicle);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !submitted}>
        <Stack.Screen name="(onboard)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && submitted}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="docs" />
      </Stack.Protected>
      <Stack.Screen name="dev" options={{ presentation: 'modal' }} />
    </Stack>
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
