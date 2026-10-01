import { Stack } from 'expo-router';
import { colors } from '@naya/tokens';
import { useA11yPrefs, useStackMotion } from '@naya/ui';

/** Protected redirects into this group land on the identity entry, which routes by case status. */
export const unstable_settings = { anchor: 'identity' };

export default function VerifyLayout() {
  const stackMotion = useStackMotion();
  const { reduceMotion } = useA11yPrefs();
  return (
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: reduceMotion ? 'none' : 'simple_push' }}>
      <Stack.Screen name="identity" />
    </Stack>
  );
}
