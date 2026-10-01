import { useStackMotion } from '@naya/ui';
import { Stack } from 'expo-router';
import { colors } from '@naya/tokens';

export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  const stackMotion = useStackMotion();
  return (
    <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
