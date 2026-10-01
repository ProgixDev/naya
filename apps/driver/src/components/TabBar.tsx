import { View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, House, UserRound, Wallet } from 'lucide-react-native';
import { colors, gutter } from '@naya/tokens';
import { Glass, PressableScale, Text, haptic } from '@naya/ui';

const ICONS = { index: House, earnings: BarChart3, wallet: Wallet, account: UserRound } as const;
const LABELS = { index: 'Accueil', earnings: 'Gains', wallet: 'Portefeuille', account: 'Compte' } as const;

/** Floating capsule tab bar; labels always visible; active item as a tinted pill. No bounce. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: gutter - 4, right: gutter - 4, bottom: Math.max(insets.bottom, 12) }} pointerEvents="box-none">
      <Glass radius={30} contentStyle={{ height: 60, paddingHorizontal: 6, justifyContent: 'space-between' }}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const name = route.name as keyof typeof ICONS;
          const Icon = ICONS[name] ?? House;
          return (
            <PressableScale
              key={route.key}
              testID={`tab-${name}`}
              pressedScale={1}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABELS[name]}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) {
                  haptic.select();
                  navigation.navigate(route.name);
                }
              }}
              style={{ flex: 1, height: 52, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: focused ? colors.accent : 'transparent' }}
            >
              <Icon size={22} color={focused ? colors.inverse : colors.muted} strokeWidth={focused ? 2.2 : 1.8} />
              <Text variant="micro" weight={focused ? 'semibold' : 'medium'} tone={focused ? 'inverse' : 'muted'} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {LABELS[name]}
              </Text>
            </PressableScale>
          );
        })}
      </Glass>
    </View>
  );
}

/** Space for content so the floating bar never covers the last row. */
export const TAB_BAR_SPACE = 96;
