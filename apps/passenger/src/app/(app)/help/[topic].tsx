import { useTheme , Button, EmptyState, Header, PressableScale, Screen, Text } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, radius } from '@naya/tokens';
import { HELP_TOPICS } from '@/features/help/topics';

/** Questions as one accordion card: the first answer is open, the others one tap away. */
export default function HelpTopic() {
  useTheme();
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const t = HELP_TOPICS.find((x) => x.id === topic);
  const [open, setOpen] = useState(0);
  if (!t) return <Screen header={<Header title="Aide" onBack={() => router.back()} />}><EmptyState title="Sujet introuvable" /></Screen>;
  return (
    <Screen header={<Header title={t.title} onBack={() => router.back()} />} footer={<Button label="Ce n’est pas résolu · créer une demande" full variant="secondary" onPress={() => router.push({ pathname: '/support/new', params: { category: t.category } })} />}>
      <View style={{ marginTop: 4, backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 16 }}>
        {t.articles.map((a, i) => {
          const expanded = open === i;
          return (
            <View key={a.q} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, paddingVertical: 12, gap: 6 }}>
              <PressableScale onPress={() => setOpen(expanded ? -1 : i)} accessibilityRole="button" accessibilityState={{ expanded }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 }} pressedScale={0.99}>
                <Text variant="label" weight="semibold" style={{ flex: 1 }}>{a.q}</Text>
                {expanded ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
              </PressableScale>
              {expanded ? <Text variant="label" tone="muted">{a.a}</Text> : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
