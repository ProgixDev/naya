import { useCallback } from 'react';
import { useTheme , useA11yPrefs, useStackMotion, FamilyNotifier } from '@naya/ui';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMe } from '@/lib/queries';
import { colors } from '@naya/tokens';

export const unstable_settings = { anchor: '(tabs)' };

/** Drill-down slides from the right; focused tasks (route, quote, forms) rise from the bottom. */
export default function AppLayout() {
  useTheme();
  const stackMotion = useStackMotion();
  const { reduceMotion } = useA11yPrefs();
  const anim = reduceMotion ? 'none' : 'simple_push';
  const me = useMe();
  // Each step of a child trip (en route, arrived, picked up, alerts…) also reaches the system tray.
  const notify = useCallback((title: string) => {
    Notifications.scheduleNotificationAsync({ content: { title: 'Naya Famille', body: title }, trigger: null }).catch(() => undefined);
  }, []);
  return (
    <>
    {me.data?.user.id ? <FamilyNotifier accountId={me.data.user.id} onNotify={notify} /> : null}
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: anim }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="route" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="quote" />
      <Stack.Screen name="ride" options={{ gestureEnabled: false }} />
      <Stack.Screen name="card/new" options={{ presentation: 'modal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
    </Stack>
    </>
  );
}
