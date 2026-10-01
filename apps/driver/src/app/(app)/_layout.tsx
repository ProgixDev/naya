import { useStackMotion, useA11yPrefs } from '@naya/ui';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { colors } from '@naya/tokens';
import { useApi } from '@naya/api/react';
import { useDriverStatus } from '@/lib/queries';
import { useLocationStream } from '@/lib/location';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/**
 * Watches the authoritative driver state. A new pending offer opens the offer screen once;
 * after a restart, an accepted ride reopens the ride screen. A local notification is shown
 * when an offer arrives while the app is in the background.
 */
function useOfferAndRideWatcher() {
  const status = useDriverStatus();
  const pathname = usePathname();
  const seenOffer = useRef<string | null>(null);
  const restored = useRef(false);
  const offer = status.data?.offer;
  const ride = status.data?.activeRide;
  useEffect(() => {
    if (offer?.status === 'pending' && seenOffer.current !== offer.id) {
      seenOffer.current = offer.id;
      if (!pathname.startsWith('/offer')) router.push('/offer');
      if (AppState.currentState !== 'active' && Platform.OS !== 'web') {
        Notifications.scheduleNotificationAsync({ content: { title: 'Nouvelle course', body: 'Vous avez 30 secondes pour répondre.' }, trigger: null }).catch(() => undefined);
      }
    }
  }, [offer?.id, offer?.status, pathname]);
  useEffect(() => {
    if (!restored.current && status.data) {
      restored.current = true;
      if (ride && !pathname.startsWith('/ride')) router.push('/ride');
    }
  }, [status.data, ride, pathname]);
}

export default function AppLayout() {
  const stackMotion = useStackMotion();
  useOfferAndRideWatcher();
  const { reduceMotion } = useA11yPrefs();
  const api = useApi();
  const status = useDriverStatus();
  useLocationStream(!!status.data?.online || !!status.data?.activeRide, (p) => api.driver.sendLocation(p).catch(() => undefined));
  return (
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="offer" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="ride" options={{ gestureEnabled: false }} />
      <Stack.Screen name="recharge/sandbox/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
