import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { motion } from '@naya/tokens';
import { useA11yPrefs } from './a11y';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: ReactNode;
  /** Scale on press; 0.96 for tiles and buttons, 1 to disable. */
  pressedScale?: number;
}

/** Subtle press compression on the UI thread. Disabled with Reduce Motion. */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { pressedScale = motion.press.scale, onPressIn, onPressOut, style, children, disabled, ...rest },
  ref,
) {
  const { reduceMotion } = useA11yPrefs();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(e) => {
        if (!reduceMotion) scale.value = withTiming(pressedScale, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) scale.value = withSpring(1, { damping: motion.press.damping, stiffness: motion.press.stiffness });
        onPressOut?.(e);
      }}
      style={[style, animated]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});
