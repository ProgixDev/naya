import { getColorScheme , colors } from '@naya/tokens';
import { useTheme } from './core/theme';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useGlassKind } from './Glass';

/**
 * Two pill materials, each with one role:
 * - Gloss (primary action only): a filled pill with a top inner highlight, a bottom inner
 *   shade and a soft coloured glow — the tactile "glowing buoy" treatment.
 * - Frost (secondary actions, inputs on maps, chips): translucent white over a blur with a
 *   bright hairline edge and a top sheen. Falls back to solid white with Reduce Transparency.
 */

const fill = StyleSheet.absoluteFill;

/** Main-action fill: one flat solid colour, no sheen or rim, so every primary pill looks the same. */
export function GlossLayers({ tone, radius }: { tone: 'accent' | 'danger'; radius: number }) {
  useTheme();
  return <View pointerEvents="none" style={[fill, { borderRadius: radius, backgroundColor: tone === 'danger' ? colors.danger : colors.accent }]} />;
}

/** Soft, wide drop shadow under a main action (lifts the pill off the page without a hard edge). */
export const glossShadow = (tone: 'accent' | 'danger'): ViewStyle => ({
  shadowColor: tone === 'danger' ? colors.danger : colors.accentDeep,
  shadowOpacity: getColorScheme() === 'dark' ? 0 : 0.24,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: getColorScheme() === 'dark' ? 0 : 6,
});

export function FrostLayers({ radius, tint = 'white' }: { radius: number; tint?: 'white' | 'mauve' }) {
  useTheme();
  const kind = useGlassKind();
  const dark = getColorScheme() === 'dark';
  const base = dark ? colors.glass : tint === 'mauve' ? 'rgba(243,233,239,0.72)' : 'rgba(255,255,255,0.62)';
  return (
    <View pointerEvents="none" style={[fill, { borderRadius: radius, overflow: 'hidden' }]}>
      {kind === 'opaque' ? (
        <View style={[fill, { backgroundColor: tint === 'mauve' ? colors.mauveSoft : colors.surface }]} />
      ) : (
        <>
          {Platform.OS !== 'android' ? <BlurView intensity={28} tint={dark ? 'dark' : 'light'} style={fill} /> : null}
          <View style={[fill, { backgroundColor: base }]} />
          {/* top sheen */}
          <LinearGradient colors={[dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={fill} />
        </>
      )}
      <View style={[fill, { borderRadius: radius, borderWidth: 1, borderColor: colors.glassBorder }]} />
    </View>
  );
}

export const frostShadow: ViewStyle = {
  shadowColor: colors.ink,
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

/** Hairline that keeps a frosted pill legible on a white surface. */
export const frostOutline: ViewStyle = { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(46,32,44,0.10)' };
