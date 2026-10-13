import { useTheme , IconDisc, ListGroup, ListRow, Sheet, StatusBanner } from '@naya/ui';
import { Alert, Linking, View } from 'react-native';
import { MessageSquare, Phone, ShieldAlert } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import type { DriverSummary } from '@naya/domain';

/**
 * Calling or messaging the driver through Naya needs a telephony provider (number masking).
 * None is configured, so the sheet says so instead of promising masked numbers or faking a
 * call. The emergency number is a real tel: link; where the device cannot dial (iPad,
 * simulator) a native alert says so: a toast would sit behind this modal sheet.
 */
export function ContactSheet({ driver, visible, onClose }: { driver: DriverSummary; visible: boolean; onClose: () => void }) {
  useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={`Contacter ${driver.firstName}`} subtitle="L’appel et le message via Naya ne sont pas encore disponibles." testID="contact-sheet">
      <View style={{ gap: 12 }}>
        <StatusBanner compact tone="warning" title="Démo" message="appels et messages : fournisseur non configuré" />
        <ListGroup>
          <ListRow title="Appeler via Naya" subtitle="Indisponible · fournisseur non configuré" leading={<IconDisc><Phone size={18} color={colors.disabledText} /></IconDisc>} />
          <ListRow title="Envoyer un message" subtitle="Indisponible · fournisseur non configuré" leading={<IconDisc><MessageSquare size={18} color={colors.disabledText} /></IconDisc>} />
          <ListRow title="Urgence · police (19)" subtitle="Appel direct depuis votre téléphone" leading={<IconDisc tone="danger"><ShieldAlert size={18} color={colors.danger} /></IconDisc>} onPress={() => Linking.openURL('tel:19').catch(() => Alert.alert('Appel impossible depuis cet appareil', 'Composez le 19 depuis un téléphone.'))} testID="call-police" />
        </ListGroup>
      </View>
    </Sheet>
  );
}
