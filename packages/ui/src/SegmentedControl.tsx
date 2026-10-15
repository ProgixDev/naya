import { themedStyles, colors, getColorScheme } from '@naya/tokens';
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
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}

/** Indicator slides on the UI thread; with Reduce Motion it jumps. */
export function SegmentedControl<T extends string>({ options, value, onChange, testID }: SegmentedControlProps<T>) {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const seg = width / options.length;
  useEffect(() => {
    x.value = reduceMotion ? index * seg : withTiming(index * seg, motionTiming.selection);
  }, [index, seg, reduceMotion, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View testID={testID} accessibilityRole="tablist" style={styles.track} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 ? <Animated.View testID={testID ? `${testID}-thumb` : undefined} style={[styles.indicator, { width: seg }, indicator]} /> : null}
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

/**
 * The selected thumb is always lighter than the track, as in light mode. In dark, `selected`
 * (#3A2938) is lighter than every surface, so the track sinks to the page background with a
 * hairline edge and the thumb rises to `elevated`. Light keeps today's mauve track.
 * Border 1 + padding 3 keeps the 4-pt inset and the 44-pt height in both schemes.
 */
const styles = themedStyles(() => StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: getColorScheme() === 'dark' ? colors.background : colors.selected, borderWidth: 1, borderColor: getColorScheme() === 'dark' ? colors.hairline : 'transparent', borderRadius: 999, padding: 3, minHeight: 44 },
  // Shadow ink is fixed (shadow.card), never colors.ink, which glows in dark.
  indicator: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 999, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.hairline, shadowColor: '#2E202C', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36, paddingHorizontal: 8 },
}));
