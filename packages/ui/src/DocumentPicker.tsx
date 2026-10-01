import { StyleSheet, View } from 'react-native';
import { BookUser, Check, FileUser, IdCard, type LucideIcon } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { useA11yPrefs } from './a11y';
import { haptic } from './haptics';

export type IdDocumentType = 'cin' | 'passport' | 'residence_permit';

/** What each document asks for next: the number field adapts its label and example. */
export const ID_DOCUMENTS: Record<IdDocumentType, { label: string; icon: LucideIcon; numberLabel: string; example: string }> = {
  cin: { label: 'CIN', icon: IdCard, numberLabel: 'Numéro de CIN', example: 'Ex. AB123456' },
  passport: { label: 'Passeport', icon: BookUser, numberLabel: 'Numéro de passeport', example: 'Ex. AA1234567' },
  residence_permit: { label: 'Titre de séjour', icon: FileUser, numberLabel: 'Numéro du titre de séjour', example: 'Comme indiqué sur la carte' },
};

const ORDER: IdDocumentType[] = ['cin', 'passport', 'residence_permit'];

/**
 * Document choice as three icon tiles (one radio group). The selected tile takes the plum
 * edge and a check; the others stay quiet white pills of the same family as the fields.
 */
export function DocumentPicker({ value, onChange, testID }: { value: IdDocumentType; onChange: (v: IdDocumentType) => void; testID?: string }) {
  const { largeText } = useA11yPrefs();
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel="Type de pièce" style={{ flexDirection: largeText ? 'column' : 'row', gap: 10 }}>
      {ORDER.map((k) => {
        const d = ID_DOCUMENTS[k];
        const on = k === value;
        const Icon = d.icon;
        return (
          <PressableScale
            key={k}
            testID={testID ? `${testID}-${k}` : undefined}
            onPress={() => {
              if (!on) haptic.select();
              onChange(k);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={d.label}
            style={[styles.tile, largeText && styles.tileRow, on && styles.on]}
          >
            <View style={[styles.iconWrap, on && { backgroundColor: colors.accent }]}>
              <Icon size={20} color={on ? colors.inverse : colors.accent} strokeWidth={1.8} />
            </View>
            <Text variant="caption" weight={on ? 'semibold' : 'medium'} tone={on ? 'ink' : 'muted'} numberOfLines={1}>
              {d.label}
            </Text>
            {on ? (
              <View style={styles.check}>
                <Check size={11} color={colors.inverse} strokeWidth={3} />
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: 88, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(46,32,44,0.07)', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 6, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  tileRow: { flex: undefined, minHeight: 60, flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 16, gap: 12 },
  on: { borderColor: colors.accent, borderWidth: 1.5, backgroundColor: '#FDF9FB', shadowColor: colors.accent, shadowOpacity: 0.14, shadowRadius: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
