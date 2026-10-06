import { useTheme } from './../core/theme';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { MapPin } from 'lucide-react-native';
import { aspect } from '@naya/assets';
import { colors } from '@naya/tokens';
import { Text } from '../Text';
import type { MapMarker } from './types';

export function MarkerView({ marker }: { marker: MapMarker }) {
  useTheme();
  if (marker.kind === 'driver') {
    return (
      <View accessibilityLabel={marker.label ?? 'Voiture de la chauffeuse'} style={{ width: 30, height: 30 / aspect.carTop, transform: [{ rotate: `${marker.heading ?? 0}deg` }] }}>
        <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 56"><rect x="3" y="2" width="24" height="52" rx="8" fill="${colors.surface}" stroke="${colors.accent}" stroke-width="3"/><path d="M7 16H23L21 25H9ZM9 35H21L23 44H7Z" fill="${colors.accent}"/></svg>`} width="100%" height="100%" />
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
