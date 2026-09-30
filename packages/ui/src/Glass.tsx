import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { colors, shadow } from '@naya/tokens';
import { useA11yPrefs } from './a11y';

const liquid = (() => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

export type GlassKind = 'liquid' | 'blur' | 'opaque';

/** Which material this device renders, for tests and the review contact sheet. */
export function useGlassKind(): GlassKind {
  const { reduceTransparency } = useA11yPrefs();
  if (reduceTransparency) return 'opaque';
  if (liquid) return 'liquid';
  if (Platform.OS === 'ios' || Platform.OS === 'web') return 'blur';
  return 'opaque'; // Android blur is costly and inconsistent; use a near-opaque pearl.
}

export interface GlassProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Floating controls carry a restrained shadow; inline glass does not. */
  floating?: boolean;
  interactive?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Selective frost for floating map controls, navigation and secondary actions only.
 * Native Liquid Glass on iOS 26+, blur elsewhere, and an opaque surface with Reduce
 * Transparency. Critical amounts and decisions never sit on this material.
 */
export function Glass({ children, style, radius = 999, floating = true, interactive = false, contentStyle }: GlassProps) {
  const kind = useGlassKind();
  const flat = StyleSheet.flatten(style) ?? {};
  const base: ViewStyle = { borderRadius: radius, overflow: 'hidden' };
  const outer: ViewStyle = { borderRadius: radius, ...(floating ? shadow.float : null) };
  if (kind === 'liquid') {
    return (
      <View style={[outer, flat]}>
        <GlassView glassEffectStyle="regular" isInteractive={interactive} style={[StyleSheet.absoluteFill, base]} />
        <View style={[base, styles.content, contentStyle]}>{children}</View>
      </View>
    );
  }
  if (kind === 'blur') {
    return (
      <View style={[outer, flat]}>
        <BlurView intensity={40} tint="light" style={[StyleSheet.absoluteFill, base]} />
        <View style={[StyleSheet.absoluteFill, base, { backgroundColor: colors.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder }]} />
        <View style={[base, styles.content, contentStyle]}>{children}</View>
      </View>
    );
  }
  return (
    <View style={[outer, { backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }, flat]}>
      <View style={[base, styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } });
