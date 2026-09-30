import { Stack } from 'expo-router';
import { colors } from '@naya/tokens';

export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
