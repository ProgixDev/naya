import { useTheme, PressableScale, Text, haptic, useA11yPrefs } from '@naya/ui';
import { type ComponentProps } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { Tabs } from 'expo-router';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Route, UserRound, Wallet } from 'lucide-react-native';
import { colors, getColorScheme, gutter } from '@naya/tokens';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, typeof Home> = { index: Home, trips: Route, wallet: Wallet, account: UserRound };
const LABELS: Record<string, string> = { index: 'Accueil', trips: 'Trajets', wallet: 'Portefeuille', account: 'Compte' };

/**
 * Floating capsule (white in light mode, deep plum-black in dark). Inactive tabs are icons only; the active tab grows
 * into a soft pill with its label. Width changes animate on the UI thread (no bounce).
 */
export function CapsuleTabBar({ state, navigation }: TabBarProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11yPrefs();
  const dark = getColorScheme() === 'dark';
  // Light: white capsule, plum active pill. Dark: deep plum-black capsule, soft light pill.
  const theme = dark
    ? { bar: '#2A1E2A', border: 'rgba(255,255,255,0.06)', pill: 'rgba(255,255,255,0.14)', on: '#FFFFFF', off: 'rgba(255,255,255,0.62)', shadow: 0.35 }
    : { bar: colors.surface, border: 'rgba(41,35,45,0.06)', pill: colors.accent, on: '#FFFFFF', off: colors.muted, shadow: 0.12 };
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: gutter, right: gutter, bottom: Math.max(insets.bottom, 12) }}>
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 8, gap: 4, borderRadius: 32, backgroundColor: theme.bar, borderWidth: 1, borderColor: theme.border, shadowColor: '#2E202C', shadowOpacity: theme.shadow, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const Icon = ICONS[route.name] ?? Home;
          return (
            <Animated.View key={route.key} layout={reduceMotion ? undefined : LinearTransition.duration(220)} style={{ flex: focused ? 2.2 : 1 }}>
              <PressableScale
                testID={`tab-${route.name}`}
                pressedScale={0.94}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={LABELS[route.name]}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    haptic.select();
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={{ height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10, backgroundColor: focused ? theme.pill : 'transparent' }}
              >
                <Icon size={22} color={focused ? theme.on : theme.off} strokeWidth={focused ? 2.2 : 1.9} />
                {focused ? (
                  <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
                    <Text weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 14, lineHeight: 18, color: theme.on }}>
                      {LABELS[route.name]}
                    </Text>
                  </Animated.View>
                ) : null}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

/** Space reserved under tab content so the floating bar never covers the last row (grows with Dynamic Type). */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return Math.max(insets.bottom, 12) + Math.round(64 + 16 * Math.max(0, Math.min(fontScale, 1.6) - 1)) + 24;
}
