import { useTheme } from './../core/theme';
import { Image, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { aspect, cars } from '@naya/assets';
import { colors } from '@naya/tokens';
import { Text } from '../Text';
import type { MapMarker } from './types';

/**
 * `onImageLoad` fires once the driver car's PNG has decoded, so a native map marker can stop tracking view
 * changes only after the image is drawn. The car uses React Native's Image, the pattern react-native-maps
 * documents for custom marker views.
 */
export function MarkerView({ marker, onImageLoad }: { marker: MapMarker; onImageLoad?: () => void }) {
  useTheme();
  if (marker.kind === 'driver') {
    return (
      <View accessibilityRole="image" accessibilityLabel={marker.label ?? 'Voiture de la chauffeuse'} style={{ width: 30, height: 30 / aspect.carTop, transform: [{ rotate: `${marker.heading ?? 0}deg` }] }}>
        <Image source={cars.top} resizeMode="contain" fadeDuration={0} onLoad={onImageLoad} onError={onImageLoad} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }
  if (marker.kind === 'me') {
    return <View accessibilityLabel="Votre position" style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.info, borderWidth: 3, borderColor: colors.surface }} />;
  }
  if (marker.kind === 'destination') {
    return (
      <View style={{ alignItems: 'center' }} accessibilityLabel={`Destination ${marker.label ?? ''}`}>
        <MapPin size={30} color={colors.accent} fill={colors.surface} strokeWidth={2.2} />
      </View>
    );
  }
  const stop = marker.kind === 'stop';
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={`${stop ? 'Arrêt' : 'Départ'} ${marker.label ?? ''}`}>
      <View style={{ width: stop ? 14 : 18, height: stop ? 14 : 18, borderRadius: stop ? 4 : 9, backgroundColor: colors.surface, borderWidth: stop ? 3 : 5, borderColor: colors.accent }} />
      {marker.label && stop ? (
        <View style={{ marginTop: 4, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text variant="micro" weight="semibold">
            {marker.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
