import { getColorScheme } from '@naya/tokens';
import { useTheme } from './core/theme';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Image } from 'expo-image';
import { journeySvg, illustrations, cars, brandAspect, brandSvg, type BrandMark as Mark } from '@naya/assets';
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

const carSources: readonly number[] = Object.values(cars);

/**
 * Art at its own aspect ratio; never stretched or cropped. Cars (`cars.*`) are the unbranded Naya Signature
 * PNG renders (ADR-0048, 15 Oct 2026); every other source picks a vector line drawing tinted with the theme.
 */
export function Illustration({ source, aspect, width, maxHeight, label, style }: { source: number; aspect: number; width?: number | `${number}%`; maxHeight?: number; label?: string; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return (
    <View style={[{ width: width ?? '100%', aspectRatio: aspect, maxHeight, alignSelf: 'center' }, style]} accessible={!!label} accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label}>
      {carSources.includes(source) ? (
        <Image source={source} contentFit="contain" style={{ width: '100%', height: '100%' }} />
      ) : (
        <SvgXml xml={journeySvg(colors.accent, colors.surface, source === illustrations.passengerIdentity ? 'identity' : source === illustrations.driverWallet ? 'wallet' : 'journey')} width="100%" height="100%" />
      )}
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
