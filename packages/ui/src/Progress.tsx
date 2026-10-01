import { View } from 'react-native';
import { colors } from '@naya/tokens';

/** Segmented step indicator (Coinbase/Persona style): one 4-pt segment per step. */
export function StepProgress({ step, total, testID }: { step: number; total: number; testID?: string }) {
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={`Étape ${step} sur ${total}`} accessibilityValue={{ min: 1, max: total, now: step }} style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? colors.accent : colors.selected }} />
      ))}
    </View>
  );
}
