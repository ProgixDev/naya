import { useTheme , useThemeReady , useStackMotion , AppProviders, DevNavigator, ErrorState } from '@naya/ui';
import '../../global.css';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@naya/tokens';
import { useSession } from '@/lib/session';
import { useIdentityCase } from '@/lib/queries';

export { ErrorBoundary } from 'expo-router';

/** react-navigation colours from the tokens, so default navigator surfaces follow light/dark too. */
function useNavigationTheme() {
  const scheme = useTheme();
  return useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.surface, text: colors.ink, border: colors.line, notification: colors.danger } };
  }, [scheme]);
}

function RootNavigator() {
  const navigationTheme = useNavigationTheme();
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
    <ThemeProvider value={navigationTheme}>
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
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const scheme = useTheme();
  // The palette is seeded from the device at import; the stored Clair/Sombre/Système choice is
  // read from AsyncStorage. Keep the splash up until it is applied so no frame paints the wrong scheme.
  const themeReady = useThemeReady();
  useEffect(() => {
    // Native root view behind screens, modals and transitions (light-only in app.config.ts).
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [scheme]);
  if (!themeReady) return null;
  return (
    <AppProviders session={useSession}>
      <RootNavigator />
      <DevNavigator app="passenger" session={useSession} />
    </AppProviders>
  );
}
