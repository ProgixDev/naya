import { Alert, Linking, StyleSheet, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { EMERGENCY_NUMBERS, MOBILE_EMERGENCY_NUMBER } from '@naya/domain';
import { useTheme } from '../core/theme';
import { Icon } from '../Icon';
import { PressableScale } from '../PressableScale';
import { Text } from '../Text';

/** Opens the dialler; where the device cannot dial (iPad, simulator, web) a native alert says so (UI-07). */
function dial(number: string) {
  Linking.openURL(`tel:${number}`).catch(() => Alert.alert('Appel impossible depuis cet appareil', `Composez le ${number} depuis un téléphone.`));
}

/**
 * The emergency numbers other than the 19, listed at the end of the safety sheet in both apps (R8, X-02):
 * the 19 is the sheet's own button. Calling the chauffeuse or the passagère through Naya needs a telephony
 * provider that is not live, so no contact sheet exists any more. Every number reads from EMERGENCY_NUMBERS.
 */
export function OtherEmergencyNumbers({ exclude = ['19'] }: { exclude?: readonly string[] }) {
  useTheme();
  const rows = EMERGENCY_NUMBERS.filter((e) => !exclude.includes(e.number));
  return (
    <View style={{ gap: 4 }} testID="emergency-numbers">
      <Text variant="caption" tone="muted" weight="semibold" accessibilityRole="header" style={{ marginTop: 8 }}>
        Autres numéros d’urgence
      </Text>
      {rows.map((e) => (
        <PressableScale
          key={e.number}
          onPress={() => dial(e.number)}
          pressedScale={0.985}
          accessibilityRole="button"
          accessibilityLabel={`Appeler le ${e.number}, ${e.name}, ${e.detail}`}
          testID={e.testID}
          style={styles.row}
        >
          {/* P-46: the number leads, the name is the detail, the trailing glyph is the call. */}
          <Text variant="heading" weight="bold" numeric style={{ fontSize: 17, minWidth: 44 }}>
            {e.number}
          </Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">{e.name}</Text>
            <Text variant="caption" tone="muted">
              {e.detail}
            </Text>
          </View>
          <Icon icon={Phone} size={20} color={colors.accent} />
        </PressableScale>
      ))}
      <Text variant="caption" tone="muted">
        Depuis un mobile, le {MOBILE_EMERGENCY_NUMBER} fonctionne aussi.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
});
