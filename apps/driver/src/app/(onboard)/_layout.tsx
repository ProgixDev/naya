import { useStackMotion } from '@naya/ui';
import { Stack } from 'expo-router';
import { colors } from '@naya/tokens';

export default function OnboardLayout() {
  const stackMotion = useStackMotion();
  return <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
