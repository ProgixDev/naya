import { useTheme , useStackMotion } from '@naya/ui';
import { Stack } from 'expo-router';
import { colors } from '@naya/tokens';

/** Signed-out visitors always start at the welcome slides, whatever URL they opened. */
export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  useTheme();
  const stackMotion = useStackMotion();
  return (
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
