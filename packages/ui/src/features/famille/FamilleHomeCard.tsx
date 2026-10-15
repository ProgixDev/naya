import { View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { statusA11y } from '@naya/domain';
import { colors, radius, shadow, themedStyles } from '@naya/tokens';
import { useTheme } from '../../core/theme';
import { Text } from '../../Text';
import { StatusIcon } from '../../StatusIcon';
import { PressableScale } from '../../PressableScale';
import { activeFamilyTrip, useFamily } from './hooks';

const s = themedStyles(() => ({
  card: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
}));

/**
 * Passenger home: a live Naya Famille card while a child's trip runs. Its leading glyph is the
 * trip's state (C11, A30): no pill and no tinted border. A start request is not shown here: it is
 * the app-wide approval banner (`FamilleApprovalBanner`, P-61/P-62), so the home never stacks two cards.
 */
export function FamilleHomeCard({ accountId, onOpenTrip }: { accountId: string; onOpenTrip: (id: string) => void }) {
  useTheme();
  const family = useFamily(accountId);
  const t = activeFamilyTrip(family.data);
  if (!t || t.status === 'awaiting_approval') return null;
  return (
    <PressableScale
      onPress={() => onOpenTrip(t.id)}
      accessibilityRole="button"
      accessibilityLabel={`Naya Famille : ${t.childName}, ${t.pickup.label} vers ${t.destination.label}, ${statusA11y('familyTrip', t.status)}`}
      style={s.card}
      testID="home-famille-live"
    >
      <StatusIcon kind="familyTrip" state={t.status} variant="disc" accessible={false} testID="home-famille-status" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" weight="semibold" numberOfLines={1}>
          {t.childName} · Naya Famille
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {t.pickup.label} → {t.destination.label}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </PressableScale>
  );
}
