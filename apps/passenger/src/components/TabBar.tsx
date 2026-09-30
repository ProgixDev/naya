import { useEffect, useState, type ComponentProps } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { Tabs } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Route, UserRound } from 'lucide-react-native';
import { colors, gutter, shadow } from '@naya/tokens';
import { Glass, PressableScale, Text, haptic, useA11yPrefs } from '@naya/ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, typeof Home> = { index: Home, trips: Route, account: UserRound };
const LABELS: Record<string, string> = { index: 'Accueil', trips: 'Trajets', account: 'Compte' };

/** Floating capsule with visible labels; the selected pill slides on the UI thread (no bounce). */
export function CapsuleTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11yPrefs();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const seg = (width - 12) / count;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = reduceMotion ? state.index * seg : withSpring(state.index * seg, { damping: 26, stiffness: 300, overshootClamping: true });
  }, [state.index, seg, reduceMotion, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: gutter - 4, right: gutter - 4, bottom: Math.max(insets.bottom, 12) }}>
      <Glass radius={32} style={shadow.float} contentStyle={{ height: 64, paddingHorizontal: 6, justifyContent: 'flex-start' }}>
        <View style={{ flex: 1, flexDirection: 'row', height: 64, alignItems: 'center' }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width + 12)} accessibilityRole="tablist">
          {width > 0 ? <Animated.View style={[{ position: 'absolute', left: 0, top: 6, bottom: 6, width: seg, borderRadius: 26, backgroundColor: colors.selected }, pill]} /> : null}
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const Icon = ICONS[route.name] ?? Home;
            return (
              <PressableScale
                key={route.key}
                testID={`tab-${route.name}`}
                pressedScale={1}
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
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 52, gap: 3 }}
              >
                <Icon size={22} color={focused ? colors.accent : colors.ink} strokeWidth={focused ? 2.3 : 1.9} />
                <Text variant="micro" weight={focused ? 'semibold' : 'medium'} tone={focused ? 'accent' : 'ink'} maxFontSizeMultiplier={1.2}>
                  {LABELS[route.name]}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

/** Space reserved at the bottom of tab screens so content clears the floating bar. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + 64 + 16;
}
