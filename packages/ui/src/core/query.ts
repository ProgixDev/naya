import { AppState, Platform, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { shouldRetry } from '@naya/api';
import { STANDALONE_DEMO } from './apiBase';

/** Refetch on app focus and pause while offline, as recommended for React Native. */
export function wireQueryLifecycle() {
  if (STANDALONE_DEMO) onlineManager.setEventListener((setOnline) => { setOnline(true); return () => undefined; });
  else onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    }),
  );
  const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
    if (Platform.OS !== 'web') focusManager.setFocused(s === 'active');
  });
  return () => sub.remove();
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: STANDALONE_DEMO ? 'always' : 'online',
        retry: shouldRetry,
        retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        networkMode: STANDALONE_DEMO ? 'always' : 'online',
        // Mutations are never retried automatically: financial and booking actions use
        // idempotency keys and are re-sent only when the person taps again.
        retry: false,
      },
    },
  });
}
