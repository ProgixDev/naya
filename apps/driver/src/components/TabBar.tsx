import { useTheme , Glass, PressableScale, Text, haptic, useTabBarTop, useToastAnchor, useScreenFocus, TAB_BAR_HEIGHT } from '@naya/ui';
import { View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartColumn, House, UserRound, Wallet } from 'lucide-react-native';
import { colors, gutter } from '@naya/tokens';

const ICONS = { index: House, earnings: ChartColumn, wallet: Wallet, account: UserRound } as const;
const LABELS = { index: 'Accueil', earnings: 'Gains', wallet: 'Portefeuille', account: 'Compte' } as const;

/** Floating capsule tab bar; labels always visible; active item as a tinted pill. No bounce. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  // X-06: on a tab screen, toasts sit just above the bar (only while the tabs are the visible screen).
  useToastAnchor({ bottom: useTabBarTop() }, useScreenFocus());
  return (
    <View style={{ position: 'absolute', left: gutter - 4, right: gutter - 4, bottom: Math.max(insets.bottom, 12) }} pointerEvents="box-none">
      <Glass radius={30} contentStyle={{ height: TAB_BAR_HEIGHT, paddingHorizontal: 6, justifyContent: 'space-between' }}>
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
              <Icon size={24} color={focused ? colors.inverse : colors.muted} strokeWidth={focused ? 2.4 : 2} />
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

/**
 * Space for content so the floating bar never covers the last row. Prefer `<Screen tabBar>`, which
 * computes the inset from the safe area and Dynamic Type (X-04); this constant stays for the screens
 * that still pass their own paddingBottom and for the home card that sits above the bar.
 */
export const TAB_BAR_SPACE = 96;
