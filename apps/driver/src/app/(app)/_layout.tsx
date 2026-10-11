import { useTheme , useStackMotion, useA11yPrefs, DriverFamilyAlerts } from '@naya/ui';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { colors } from '@naya/tokens';
import { useApi } from '@naya/api/react';
import { useQuery } from '@tanstack/react-query';
import type { FamilyOverview } from '@naya/domain';
import { useDriverStatus, useMe } from '@/lib/queries';
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
  useTheme();
  const stackMotion = useStackMotion();
  useOfferAndRideWatcher();
  const { reduceMotion } = useA11yPrefs();
  const api = useApi();
  const status = useDriverStatus();
  const me = useMe();
  // A child trip under way also streams the phone's real position (live tracking for the parent).
  const family = useQuery({ queryKey: ['naya', me.data?.user.id ?? 'driver', 'family'], queryFn: api.prototype.family, enabled: !!me.data?.user.id });
  const familyTrip = (family.data as FamilyOverview | undefined)?.trips.find((t) => ['en_route', 'arrived', 'picked_up', 'in_progress', 'at_destination'].includes(t.status));
  const dispatching = !!status.data?.online || !!status.data?.activeRide;
  useLocationStream(dispatching || !!familyTrip, (p) => {
    if (dispatching) api.driver.sendLocation(p).catch(() => undefined);
    if (familyTrip) api.prototype.familyLocation(familyTrip.id, p).catch(() => undefined);
  });
  // A parent's report on a child trip also reaches the system tray.
  const notifyFamily = useCallback((title: string, body: string) => {
    Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null }).catch(() => undefined);
  }, []);
  return (
    <>
    {me.data?.user.id ? <DriverFamilyAlerts accountId={me.data.user.id} onNotify={notifyFamily} /> : null}
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="offer" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="ride" options={{ gestureEnabled: false }} />
      <Stack.Screen name="recharge/sandbox/[id]" options={{ presentation: 'modal' }} />
    </Stack>
    </>
  );
}
