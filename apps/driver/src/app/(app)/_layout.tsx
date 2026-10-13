import { useTheme , useStackMotion, useA11yPrefs, toast } from '@naya/ui';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { colors } from '@naya/tokens';
import { serverClock } from '@naya/api';
import { useApi } from '@naya/api/react';
import { useDriverStatus } from '@/lib/queries';
import { useLocationStream } from '@/lib/location';
import { startRideTracking, stopRideTracking } from '@/lib/backgroundLocation';

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
      // The response window is set per city: announce what is left of this offer's deadline.
      const left = Math.ceil((Date.parse(offer.expiresAt) - serverClock.now()) / 1000);
      if (AppState.currentState !== 'active' && Platform.OS !== 'web' && left > 0) {
        Notifications.scheduleNotificationAsync({ content: { title: 'Nouvelle course', body: `Vous avez ${left} seconde${left > 1 ? 's' : ''} pour répondre.` }, trigger: null }).catch(() => undefined);
      }
    }
  }, [offer?.id, offer?.status, offer?.expiresAt, pathname]);
  useEffect(() => {
    if (!restored.current && status.data) {
      restored.current = true;
      if (ride && !pathname.startsWith('/ride')) router.push('/ride');
    }
  }, [status.data, ride, pathname]);
}

/**
 * Lock-screen location sharing follows the server's active ride, not the ride screen: going back
 * home keeps it on, and it stops once the server reports no accepted ride (completion or
 * cancellation by either side), including at app start after the app was killed mid-ride.
 * Sign-out stops it too (lib/session).
 */
function useRideTracking() {
  const status = useDriverStatus();
  const rideId = status.data ? (status.data.activeRide?.id ?? null) : undefined;
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (rideId === undefined) return;
    if (rideId && tracked.current !== rideId) {
      tracked.current = rideId;
      startRideTracking().then((r) => {
        if (r === 'foreground-only') toast('Position partagée seulement quand l’application est ouverte.');
      });
    } else if (!rideId) {
      tracked.current = null;
      void stopRideTracking();
    }
  }, [rideId]);
}

export default function AppLayout() {
  useTheme();
  const stackMotion = useStackMotion();
  useOfferAndRideWatcher();
  useRideTracking();
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
