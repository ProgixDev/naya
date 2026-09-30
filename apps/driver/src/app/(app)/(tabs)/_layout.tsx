import { Tabs } from 'expo-router';
import { colors } from '@naya/tokens';
import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
