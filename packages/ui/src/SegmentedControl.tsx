import { themedStyles , colors } from '@naya/tokens';
import { useTheme } from './core/theme';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motionTiming } from './motion';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { useA11yPrefs } from './a11y';
import { haptic } from './haptics';

export interface SegmentedControlProps<T extends string> {
  /** `count` shows a small badge next to the label (underline variant). */
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
  /** `pill` (default): sliding white pill on a tinted track. `underline`: text tabs with a plum bar under the active one. */
  variant?: 'pill' | 'underline';
}

/** Indicator slides on the UI thread; with Reduce Motion it jumps. */
export function SegmentedControl<T extends string>({ options, value, onChange, testID, variant = 'pill' }: SegmentedControlProps<T>) {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const underline = variant === 'underline';
  const seg = (underline ? width + 8 : width) / options.length;
  useEffect(() => {
    x.value = reduceMotion ? index * seg : withTiming(index * seg, motionTiming.selection);
  }, [index, seg, reduceMotion, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  if (underline) {
    return (
      <View testID={testID} accessibilityRole="tablist" style={styles.uTrack} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <PressableScale
              key={o.value}
              onPress={() => {
                if (!on) haptic.select();
                onChange(o.value);
              }}
              pressedScale={1}
              accessibilityRole="tab"
              accessibilityLabel={o.count ? `${o.label}, ${o.count}` : o.label}
              accessibilityState={{ selected: on }}
              style={styles.uItem}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text weight={on ? 'semibold' : 'medium'} tone={on ? 'ink' : 'muted'} numberOfLines={1} style={{ fontSize: 16, lineHeight: 22 }}>
                  {o.label}
                </Text>
                {o.count ? (
                  <View style={[styles.badge, { backgroundColor: on ? colors.accent : colors.selected }]}>
                    <Text weight="semibold" numeric tone={on ? 'inverse' : 'muted'} style={{ fontSize: 12, lineHeight: 16 }}>{o.count}</Text>
                  </View>
                ) : null}
              </View>
            </PressableScale>
          );
        })}
        {width > 0 ? (
          <Animated.View style={[styles.uIndicator, { width: seg }, indicator]}>
            <View style={styles.uBar} />
          </Animated.View>
        ) : null}
      </View>
    );
  }
  return (
    <View testID={testID} accessibilityRole="tablist" style={styles.track} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 ? <Animated.View style={[styles.indicator, { width: seg }, indicator]} /> : null}
      {options.map((o) => (
        <PressableScale
          key={o.value}
          onPress={() => {
            if (o.value !== value) haptic.select();
            onChange(o.value);
          }}
          pressedScale={1}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          style={styles.item}
        >
          <Text variant="caption" weight={o.value === value ? 'semibold' : 'medium'} tone={o.value === value ? 'ink' : 'muted'} numberOfLines={1}>
            {o.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.selected, borderRadius: 999, padding: 4, minHeight: 44 },
  indicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 999, backgroundColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36, paddingHorizontal: 8 },
  uTrack: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, minHeight: 48 },
  uItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 8 },
  uIndicator: { position: 'absolute', left: 0, bottom: -1, height: 3, alignItems: 'center' },
  uBar: { width: '56%', height: 3, borderRadius: 2, backgroundColor: colors.accent },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
}));
