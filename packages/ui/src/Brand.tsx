import { getColorScheme } from '@naya/tokens';
import { useTheme } from './core/theme';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Image } from 'expo-image';
import { journeySvg, vehicleSvg, illustrations, cars, brandAspect, brandSvg, type BrandMark as Mark } from '@naya/assets';
import { colors } from '@naya/tokens';
import { Text } from './Text';

/** The supplied "Rencontre" symbol and wordmark, rendered from their original SVG. */
export function BrandMark({ mark = 'lockup', height = 28, style }: { mark?: Mark; height?: number; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return (
    <View style={style} accessibilityRole="image" accessibilityLabel="Naya">
      <SvgXml xml={getColorScheme() === 'dark' ? brandSvg[mark].replace(/#6B3657/gi, colors.accent).replace(/#29232D/gi, colors.ink) : brandSvg[mark]} height={height} width={height * brandAspect[mark]} />
    </View>
  );
}

/** Transparent raster art at its own aspect ratio; never stretched or cropped. */
export function Illustration({ source, aspect, width, maxHeight, label, style }: { source: number; aspect: number; width?: number | `${number}%`; maxHeight?: number; label?: string; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return (
    <View style={[{ width: width ?? '100%', aspectRatio: aspect, maxHeight, alignSelf: 'center' }, style]} accessible={!!label} accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label}>
      <SvgXml xml={Object.values(cars).includes(source) ? vehicleSvg(colors.accent, colors.surface) : journeySvg(colors.accent, colors.surface, source === illustrations.passengerIdentity ? 'identity' : source === illustrations.driverWallet ? 'wallet' : 'journey')} width="100%" height="100%" />
    </View>
  );
}

export function Avatar({ source, name, size = 44 }: { source?: number | { uri: string; headers?: Record<string, string> } | null; name: string; size?: number }) {
  useTheme();
  if (source) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.selected }} accessibilityRole="image" accessibilityLabel={name}>
        <Image source={source} style={{ width: size, height: size }} contentFit="cover" />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={name}>
      <Text variant="label" weight="semibold" tone="accent">
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Marks content produced by the demo environment (simulated movement, sandbox payments…). */
export function DemoBadge({ label = 'Démo' }: { label?: string }) {
  useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, height: 22, borderRadius: 999, backgroundColor: colors.warningSoft, justifyContent: 'center' }} accessibilityLabel={`${label} : environnement de démonstration`}>
      <Text variant="micro" weight="semibold" tone="warning">
        {label}
      </Text>
    </View>
  );
}
