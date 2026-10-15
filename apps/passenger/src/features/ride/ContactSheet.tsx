import { useTheme , IconDisc, ListGroup, ListRow, Sheet, Text } from '@naya/ui';
import { ScrollView } from 'react-native';
import { MessageSquare, Phone, ShieldAlert } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import type { DriverSummary } from '@naya/domain';
import { dialEmergency, EMERGENCY_NUMBERS, MOBILE_EMERGENCY_NUMBER } from '@/features/help/emergency';

/**
 * Calling or messaging the driver through Naya needs a telephony provider (number masking).
 * None is configured, so the sheet says so instead of promising masked numbers or faking a
 * call. The emergency numbers (police 19, Protection civile 15, Gendarmerie 177) are real
 * tel: links; where the device cannot dial (iPad, simulator) a native alert says so: a toast
 * would sit behind this modal sheet. The sheet does not scroll on its own: the rows sit in a
 * ScrollView so the emergency numbers stay reachable at the largest text sizes.
 */
export function ContactSheet({ driver, visible, onClose }: { driver: DriverSummary; visible: boolean; onClose: () => void }) {
  useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={`Contacter ${driver.firstName}`} subtitle="L’appel et le message via Naya ne sont pas encore disponibles." testID="contact-sheet">
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }} bounces={false}>
        <ListGroup>
          <ListRow title="Appeler via Naya" subtitle="Bientôt disponible" leading={<IconDisc><Phone size={18} color={colors.disabledText} /></IconDisc>} />
          <ListRow title="Envoyer un message" subtitle="Bientôt disponible" leading={<IconDisc><MessageSquare size={18} color={colors.disabledText} /></IconDisc>} />
        </ListGroup>
        <ListGroup label="Urgence · appel direct depuis votre téléphone">
          {EMERGENCY_NUMBERS.map((e) => (
            <ListRow
              key={e.number}
              title={`${e.name} · ${e.number}`}
              subtitle={e.detail}
              accessibilityHint={`Appelle le ${e.number} depuis votre téléphone`}
              leading={<IconDisc tone="danger"><ShieldAlert size={18} color={colors.danger} /></IconDisc>}
              onPress={() => dialEmergency(e.number)}
              testID={e.testID}
            />
          ))}
        </ListGroup>
        <Text variant="caption" tone="muted" style={{ paddingHorizontal: 4 }}>Depuis un mobile, le {MOBILE_EMERGENCY_NUMBER} fonctionne aussi.</Text>
      </ScrollView>
    </Sheet>
  );
}
