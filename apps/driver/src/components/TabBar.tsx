import { CapsuleTabBar } from '@naya/ui';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { BarChart3, House, UserRound, Wallet } from 'lucide-react-native';

const ITEMS = {
  index: { icon: House, label: 'Accueil' },
  earnings: { icon: BarChart3, label: 'Gains' },
  wallet: { icon: Wallet, label: 'Portefeuille' },
  account: { icon: UserRound, label: 'Compte' },
};

/** Same floating capsule as the passenger app (shared in @naya/ui). */
export function TabBar(props: BottomTabBarProps) {
  return <CapsuleTabBar state={props.state} navigation={props.navigation as never} items={ITEMS} />;
}

/** Space for content so the floating bar never covers the last row (bar 64 + bottom inset + margin). */
export const TAB_BAR_SPACE = 100;
