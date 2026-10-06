import { useTheme , useA11yPrefs } from '@naya/ui';
import { Tabs } from 'expo-router';
import { colors, motion } from '@naya/tokens';
import { CapsuleTabBar } from '@/components/TabBar';

export default function TabsLayout() {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  return (
    <Tabs
      tabBar={(props) => <CapsuleTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade', transitionSpec: { animation: 'timing', config: { duration: reduceMotion ? 0 : motion.tabFade } }, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trajets' }} />
      <Tabs.Screen name="account" options={{ title: 'Compte' }} />
    </Tabs>
  );
}
