import { Stack } from 'expo-router';
import { colors } from '@naya/tokens';

export default function DocsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
