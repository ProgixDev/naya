import { Stack } from 'expo-router';
import { colors } from '@naya/tokens';
import { useA11yPrefs, useStackMotion } from '@naya/ui';

export const unstable_settings = { anchor: '(tabs)' };

/** Drill-down slides from the right; focused tasks (route, quote, forms) rise from the bottom. */
export default function AppLayout() {
  const stackMotion = useStackMotion();
  const { reduceMotion } = useA11yPrefs();
  const anim = reduceMotion ? 'none' : 'simple_push';
  return (
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: anim }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="route" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="quote" />
      <Stack.Screen name="ride" options={{ gestureEnabled: false }} />
      <Stack.Screen name="card/new" options={{ presentation: 'modal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
    </Stack>
  );
}
