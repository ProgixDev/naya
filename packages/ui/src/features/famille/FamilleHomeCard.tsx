import { View } from 'react-native';
import { ChevronRight, ShieldCheck } from 'lucide-react-native';
import { FAMILY_STATUS_LABELS } from '@naya/domain';
import { colors, radius, shadow, themedStyles } from '@naya/tokens';
import { useTheme } from '../../core/theme';
import { Text } from '../../Text';
import { StatusPill } from '../../Feedback';
import { PressableScale } from '../../PressableScale';
import { activeFamilyTrip, useFamily } from './hooks';

const s = themedStyles(() => ({
  card: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.hairline, ...shadow.card },
}));

/**
 * Passenger home: a live Naya Famille card while a child's trip runs. An approval request is
 * shown first, in the warning tone, because the trip cannot start without it.
 */
export function FamilleHomeCard({ accountId, onOpenTrip }: { accountId: string; onOpenTrip: (id: string) => void }) {
  useTheme();
  const family = useFamily(accountId);
  const t = activeFamilyTrip(family.data);
  if (!t) return null;
  const approval = t.status === 'awaiting_approval';
  return (
    <PressableScale onPress={() => onOpenTrip(t.id)} accessibilityRole="button" accessibilityLabel={`Naya Famille : ${t.childName}, ${FAMILY_STATUS_LABELS[t.status]}`} style={[s.card, approval ? { borderWidth: 2, borderColor: colors.warning } : null]} testID="home-famille-live">
      <ShieldCheck size={22} color={approval ? colors.warning : colors.accent} />
      <View style={{ flex: 1, gap: 4 }}>
        <StatusPill tone={approval ? 'warning' : 'info'} label={approval ? 'Votre accord est demandé' : FAMILY_STATUS_LABELS[t.status]} />
        <Text variant="label" numberOfLines={1}>
          {t.childName} · {t.pickup.label} → {t.destination.label}
        </Text>
      </View>
      <ChevronRight size={22} color={colors.ink} />
    </PressableScale>
  );
}
