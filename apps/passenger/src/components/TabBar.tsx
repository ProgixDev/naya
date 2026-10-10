import { CapsuleTabBar as Bar, useTabBarSpace } from '@naya/ui';
import { type ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import { Home, Route, UserRound, Wallet } from 'lucide-react-native';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ITEMS = {
  index: { icon: Home, label: 'Accueil' },
  trips: { icon: Route, label: 'Trajets' },
  wallet: { icon: Wallet, label: 'Portefeuille' },
  account: { icon: UserRound, label: 'Compte' },
};

export function CapsuleTabBar(props: TabBarProps) {
  return <Bar state={props.state} navigation={props.navigation as never} items={ITEMS} />;
}

export { useTabBarSpace };
