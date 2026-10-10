import { useTheme, Button, IconButton, NayaMap, StatusBanner, Text } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MapPin, X } from 'lucide-react-native';
import { isInService, type LatLng, type Place } from '@naya/domain';
import { useApi } from '@naya/api/react';
import { colors, gutter, radius, shadow } from '@naya/tokens';

/** Manual pin: the map moves under a fixed centre pin; the address resolves when it stops. */
export function PinPicker({ initial, zones, title, onConfirm, onCancel, confirmLabel = 'Confirmer ce point' }: { initial: LatLng; zones: { polygon: LatLng[]; active: boolean; id: string; cityId: string; name: string }[]; title: string; onConfirm: (p: Place) => void; onCancel: () => void; confirmLabel?: string }) {
  useTheme();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [center, setCenter] = useState(initial);
  const place = useQuery({ queryKey: ['naya', 'public', 'reverse', center.lat.toFixed(5), center.lng.toFixed(5)], queryFn: () => api.places.reverse(center) });
  const inZone = isInService(center, zones);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="pin-picker">
      <NayaMap center={initial} zoom={16} onCenterChange={setCenter} bottomInset={240} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 240, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <View style={{ backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}>
            <Text variant="caption" tone="inverse" weight="semibold">{title}</Text>
          </View>
          <MapPin size={40} color={colors.accent} fill={colors.surface} strokeWidth={2.2} />
        </View>
      </View>
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter }}>
        <IconButton icon={<X size={22} color={colors.ink} />} accessibilityLabel="Annuler" onPress={onCancel} testID="pin-cancel" />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: gutter, paddingBottom: insets.bottom + 16, gap: 12, ...shadow.float }}>
        <Text variant="heading">{title}</Text>
        <Text variant="label" tone="muted" numberOfLines={2}>{place.data?.address ?? 'Déplacez la carte pour placer le repère…'}</Text>
        {!inZone ? <StatusBanner compact tone="danger" title="Hors zone" message="déplacez le repère dans la zone de service" testID="pin-out-of-zone" /> : null}
        <Button label={confirmLabel} size="major" full disabled={!place.data || !inZone} onPress={() => place.data && onConfirm(place.data)} testID="confirm-pin" />
      </View>
    </View>
  );
}
