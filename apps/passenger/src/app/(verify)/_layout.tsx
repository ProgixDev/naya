import { Stack } from 'expo-router';
import { colors } from '@naya/tokens';
import { useA11yPrefs } from '@naya/ui';

/** Protected redirects into this group land on the identity entry, which routes by case status. */
export const unstable_settings = { anchor: 'identity' };

export default function VerifyLayout() {
  const { reduceMotion } = useA11yPrefs();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: reduceMotion ? 'none' : 'default' }}>
      <Stack.Screen name="identity" />
    </Stack>
  );
}
