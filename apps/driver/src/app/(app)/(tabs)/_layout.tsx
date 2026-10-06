import { useTheme , useA11yPrefs } from '@naya/ui';
import { Tabs } from 'expo-router';
import { colors, motion } from '@naya/tokens';
import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background }, animation: reduceMotion ? 'none' : 'fade', transitionSpec: { animation: 'timing', config: { duration: reduceMotion ? 0 : motion.tabFade } } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
