import { View } from 'react-native';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { Button, IconDisc, Sheet, Text, TextButton } from '@naya/ui';

/** Pre-permission sheet: why, and the alternative. The system prompt only follows a tap. */
export function LocationExplainer({ visible, onAllow, onManual, onClose }: { visible: boolean; onAllow: () => void; onManual: () => void; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Utiliser votre position ?" testID="location-explainer">
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconDisc><LocateFixed size={20} color={colors.accent} /></IconDisc>
          <Text variant="label" style={{ flex: 1 }}>Nous proposons votre point de départ, uniquement pendant l’utilisation de l’app.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconDisc><MapPin size={20} color={colors.accent} /></IconDisc>
          <Text variant="label" style={{ flex: 1 }}>Vous pouvez aussi placer le départ vous-même sur la carte.</Text>
        </View>
        <Button label="Autoriser la position" full onPress={onAllow} testID="allow-location" />
        <TextButton label="Choisir sur la carte" onPress={onManual} testID="manual-pickup" />
      </View>
    </Sheet>
  );
}
