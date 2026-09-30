import { Linking, View } from 'react-native';
import { MessageSquare, Phone, ShieldAlert } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { IconDisc, ListGroup, ListRow, Sheet, StatusBanner } from '@naya/ui';
import type { DriverSummary } from '@naya/domain';

/**
 * Masked calling and messaging need a telephony provider (number masking). None is
 * configured in the demo, so the options explain the dependency instead of faking a call.
 */
export function ContactSheet({ driver, visible, onClose }: { driver: DriverSummary; visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={`Contacter ${driver.firstName}`} subtitle="Vos numéros restent masqués." testID="contact-sheet">
      <View style={{ gap: 14 }}>
        <StatusBanner tone="warning" title="Appel et message masqués indisponibles" message="Cette fonction nécessite un fournisseur de téléphonie avec masquage de numéro, non configuré dans la démonstration." />
        <ListGroup>
          <ListRow title="Appeler via Naya" subtitle="Indisponible · fournisseur non configuré" leading={<IconDisc><Phone size={18} color={colors.disabledText} /></IconDisc>} />
          <ListRow title="Envoyer un message" subtitle="Indisponible · fournisseur non configuré" leading={<IconDisc><MessageSquare size={18} color={colors.disabledText} /></IconDisc>} />
          <ListRow title="Urgence · police (19)" subtitle="Appel direct depuis votre téléphone" leading={<IconDisc tone="danger"><ShieldAlert size={18} color={colors.danger} /></IconDisc>} onPress={() => Linking.openURL('tel:19')} testID="call-police" />
        </ListGroup>
      </View>
    </Sheet>
  );
}
