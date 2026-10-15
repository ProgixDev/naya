import { useTheme, useA11yPrefs, useStackMotion, FamilleApprovalBanner } from '@naya/ui';
import { View } from 'react-native';
import { router, Stack, usePathname } from 'expo-router';
import { colors } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';
import { useFamilyAlerts } from '@/features/family/useFamilyAlerts';

export const unstable_settings = { anchor: '(tabs)' };

/**
 * Drill-down slides from the right; focused tasks (route, quote, forms) rise from the bottom.
 * A Naya Famille start request is a banner over whatever screen is open (P-62), never a route
 * change: it hides where the approval card is already shown (Famille home, that trip).
 */
export default function AppLayout() {
  useTheme();
  const stackMotion = useStackMotion();
  const { reduceMotion } = useA11yPrefs();
  const anim = reduceMotion ? 'none' : 'simple_push';
  const accountId = useAccountId();
  const pathname = usePathname();
  useFamilyAlerts(accountId, true);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack screenOptions={{ ...stackMotion, headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: anim }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="route" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
        <Stack.Screen name="quote" />
        <Stack.Screen name="ride" options={{ gestureEnabled: false }} />
        <Stack.Screen name="card/new" options={{ presentation: 'modal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
      </Stack>
      <FamilleApprovalBanner
        accountId={accountId}
        hidden={(tripId) => pathname === '/family' || pathname === `/family/${tripId}`}
        // Below the screen's top row, so its controls stay reachable for the whole approval window: the 44-pt
        // back button / city pill everywhere, and on the ride the safety disc with its « Sécurité » label.
        offset={pathname === '/ride' ? 72 : 52}
        onOpenTrip={(id) => router.push({ pathname: '/family/[id]', params: { id } })}
      />
    </View>
  );
}
