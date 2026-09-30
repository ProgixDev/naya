import { Tabs } from 'expo-router';
import { colors } from '@naya/tokens';
import { useA11yPrefs } from '@naya/ui';
import { CapsuleTabBar } from '@/components/TabBar';

export default function TabsLayout() {
  const { reduceMotion } = useA11yPrefs();
  return (
    <Tabs
      tabBar={(props) => <CapsuleTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade', sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trajets' }} />
      <Tabs.Screen name="account" options={{ title: 'Compte' }} />
    </Tabs>
  );
}
