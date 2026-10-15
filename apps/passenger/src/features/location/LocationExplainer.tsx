import { useTheme, Button, IconDisc, Sheet, Text, TextButton } from '@naya/ui';
import { Linking, Platform, View } from 'react-native';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { colors } from '@naya/tokens';

/**
 * Pre-permission sheet: why, and the alternative. The system prompt only follows a tap.
 * Once the passenger has refused, the system will not ask again: the sheet then says where to turn it back on
 * (`denied`), and placing the pickup on the map stays the other way.
 */
export function LocationExplainer({ visible, onAllow, onManual, onClose, denied = false }: { visible: boolean; onAllow: () => void; onManual: () => void; onClose: () => void; denied?: boolean }) {
  useTheme();
  // The web has no settings page to open: there the browser's own prompt is the only way back.
  const canOpenSettings = denied && Platform.OS !== 'web';
  return (
    <Sheet visible={visible} onClose={onClose} title={denied ? 'Localisation désactivée' : 'Utiliser votre position ?'} testID="location-explainer">
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconDisc><LocateFixed size={20} color={colors.accent} /></IconDisc>
          <Text variant="label" style={{ flex: 1 }}>
            {denied ? 'Activez la localisation de Naya dans les réglages pour partir de votre position.' : 'Nous proposons votre point de départ, uniquement pendant l’utilisation de l’app.'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconDisc><MapPin size={20} color={colors.accent} /></IconDisc>
          <Text variant="label" style={{ flex: 1 }}>Vous pouvez aussi placer le départ vous-même sur la carte.</Text>
        </View>
        {canOpenSettings ? (
          <Button label="Ouvrir les réglages" full onPress={() => { onClose(); void Linking.openSettings(); }} testID="open-location-settings" />
        ) : (
          <Button label="Autoriser la position" full onPress={onAllow} testID="allow-location" />
        )}
        <TextButton label="Choisir sur la carte" onPress={onManual} testID="manual-pickup" />
      </View>
    </Sheet>
  );
}
