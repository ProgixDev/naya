import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryClientProvider, useQueryClient, onlineManager } from '@tanstack/react-query';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { ApiProvider } from '@naya/api/react';
import { createApiClient, qk, type ApiClient } from '@naya/api';
import { colors } from '@naya/tokens';
import { ToastHost } from '../Toast';
import { StatusBanner } from '../Feedback';
import { createQueryClient, wireQueryLifecycle } from './query';
import { resolveApiBase } from './apiBase';
import type { SessionStore } from './session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export function useMakeClient(session: SessionStore): { api: ApiClient; queryClient: ReturnType<typeof createQueryClient> } {
  const [state] = useState(() => {
    const queryClient = createQueryClient();
    const api = createApiClient({
      baseUrl: resolveApiBase(),
      getToken: () => session.getState().token,
      onUnauthorized: () => {
        queryClient.removeQueries({ queryKey: qk.root });
        session.getState().signOut();
      },
    });
    return { api, queryClient };
  });
  return state;
}

/** Clears every account-scoped cache when the signed-in account changes or signs out. */
function AccountBoundary({ session, children }: { session: SessionStore; children: ReactNode }) {
  const qc = useQueryClient();
  const accountId = session((s) => s.accountId);
  const [prev, setPrev] = useState(accountId);
  useEffect(() => {
    if (prev !== accountId) {
      // Clear only when leaving an account (sign-out or switch). Clearing on sign-in would
      // race the new account's first queries.
      if (prev !== null) qc.removeQueries({ queryKey: qk.root });
      setPrev(accountId);
    }
  }, [accountId, prev, qc]);
  return <>{children}</>;
}

function OfflineBanner() {
  const [online, setOnline] = useState(onlineManager.isOnline());
  const insets = useSafeAreaInsets();
  useEffect(() => onlineManager.subscribe(setOnline), []);
  if (online) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16 }}>
      <StatusBanner tone="warning" title="Hors ligne" message="Les informations affichées peuvent ne plus être à jour." />
    </View>
  );
}

export function AppProviders({ session, children }: { session: SessionStore; children: ReactNode }) {
  const { api, queryClient } = useMakeClient(session);
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const status = session((s) => s.status);
  useEffect(() => wireQueryLifecycle(), []);
  useEffect(() => {
    session.getState().restore();
  }, [session]);
  const ready = (fontsLoaded || !!fontError) && status !== 'loading';
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <ApiProvider client={api}>
              <AccountBoundary session={session}>
                {children}
                <OfflineBanner />
                <ToastHost />
              </AccountBoundary>
            </ApiProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
