import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@naya/tokens';
import { useGlassKind } from './Glass';

/**
 * Two pill materials, each with one role:
 * - Gloss (primary action only): a filled pill with a top inner highlight, a bottom inner
 *   shade and a soft coloured glow — the tactile "glowing buoy" treatment.
 * - Frost (secondary actions, inputs on maps, chips): translucent white over a blur with a
 *   bright hairline edge and a top sheen. Falls back to solid white with Reduce Transparency.
 */

const fill = StyleSheet.absoluteFill;

export function GlossLayers({ tone, radius }: { tone: 'accent' | 'danger'; radius: number }) {
  const stops = tone === 'danger' ? (['#BC4452', colors.danger, '#8C2733'] as const) : (['#8A4F74', colors.accent, '#552647'] as const);
  return (
    <View pointerEvents="none" style={[fill, { borderRadius: radius, overflow: 'hidden' }]}>
      <LinearGradient colors={stops} locations={[0, 0.5, 1]} style={fill} />
      {/* top inner highlight */}
      <LinearGradient colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']} locations={[0, 0.45, 0.6]} style={fill} />
      {/* bottom inner shade */}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(20,0,14,0.16)']} locations={[0.55, 1]} style={fill} />
      <View style={[fill, { borderRadius: radius, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }]} />
    </View>
  );
}

export const glossShadow = (tone: 'accent' | 'danger'): ViewStyle => ({
  shadowColor: tone === 'danger' ? colors.danger : colors.accent,
  shadowOpacity: 0.3,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 7 },
  elevation: 5,
});

export function FrostLayers({ radius, tint = 'white' }: { radius: number; tint?: 'white' | 'mauve' }) {
  const kind = useGlassKind();
  const base = tint === 'mauve' ? 'rgba(243,233,239,0.72)' : 'rgba(255,255,255,0.62)';
  return (
    <View pointerEvents="none" style={[fill, { borderRadius: radius, overflow: 'hidden' }]}>
      {kind === 'opaque' ? (
        <View style={[fill, { backgroundColor: tint === 'mauve' ? colors.mauveSoft : colors.surface }]} />
      ) : (
        <>
          {Platform.OS !== 'android' ? <BlurView intensity={28} tint="light" style={fill} /> : null}
          <View style={[fill, { backgroundColor: base }]} />
          {/* top sheen */}
          <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={fill} />
        </>
      )}
      <View style={[fill, { borderRadius: radius, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)' }]} />
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
