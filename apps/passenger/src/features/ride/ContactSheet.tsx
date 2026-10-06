import { useTheme , IconDisc, ListGroup, ListRow, Sheet, StatusBanner } from '@naya/ui';
import { Linking, View } from 'react-native';
import { MessageSquare, Phone, ShieldAlert } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import type { DriverSummary } from '@naya/domain';

/**
 * Masked calling and messaging need a telephony provider (number masking). None is
 * configured in the demo, so the options explain the dependency instead of faking a call.
 */
export function ContactSheet({ driver, visible, onClose }: { driver: DriverSummary; visible: boolean; onClose: () => void }) {
  useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={`Contacter ${driver.firstName}`} subtitle="Vos numéros restent masqués." testID="contact-sheet">
      <View style={{ gap: 12 }}>
        <StatusBanner compact tone="warning" title="Démo" message="appel masqué : fournisseur non configuré" />
        <ListGroup>
          <ListRow title="Appeler via Naya" subtitle="Indisponible · fournisseur non configuré" leading={<IconDisc><Phone size={18} color={colors.disabledText} /></IconDisc>} />
          <ListRow title="Envoyer un message" subtitle="Indisponible · fournisseur non configuré" leading={<IconDisc><MessageSquare size={18} color={colors.disabledText} /></IconDisc>} />
          <ListRow title="Urgence · police (19)" subtitle="Appel direct depuis votre téléphone" leading={<IconDisc tone="danger"><ShieldAlert size={18} color={colors.danger} /></IconDisc>} onPress={() => Linking.openURL('tel:19')} testID="call-police" />
        </ListGroup>
      </View>
    </Sheet>
  );
}
