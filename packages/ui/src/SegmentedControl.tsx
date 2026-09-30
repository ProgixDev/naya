import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors } from '@naya/tokens';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { useA11yPrefs } from './a11y';
import { haptic } from './haptics';

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}

/** Indicator slides on the UI thread; with Reduce Motion it jumps. */
export function SegmentedControl<T extends string>({ options, value, onChange, testID }: SegmentedControlProps<T>) {
  const { reduceMotion } = useA11yPrefs();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const seg = width / options.length;
  useEffect(() => {
    x.value = reduceMotion ? index * seg : withSpring(index * seg, { damping: 22, stiffness: 260 });
  }, [index, seg, reduceMotion, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
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

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.selected, borderRadius: 999, padding: 4, minHeight: 44 },
  indicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 999, backgroundColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36, paddingHorizontal: 8 },
});
