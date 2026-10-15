import { useTheme, Button, EmptyState, Header, Icon, ListGroup, PressableScale, Screen, Text } from '@naya/ui';
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, Phone } from 'lucide-react-native';
import { colors, radius } from '@naya/tokens';
import { HELP_TOPICS } from '@/features/help/topics';
import { dialEmergency, EMERGENCY_NUMBERS } from '@/features/help/emergency';

/**
 * One emergency number (P-46, A93): the number leads in large type, the service under it in grey, and a
 * trailing `Phone` says the row places a call. The three rows no longer share one red shield.
 */
function EmergencyRow({ number, name, detail, testID }: { number: string; name: string; detail: string; testID: string }) {
  useTheme();
  return (
    <PressableScale
      onPress={() => dialEmergency(number)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${number}, ${detail}`}
      accessibilityHint={`Appelle le ${number} depuis votre téléphone`}
      pressedScale={0.985}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10 }}
      testID={testID}
    >
      <Text variant="heading" weight="bold" numeric style={{ minWidth: 44 }}>{number}</Text>
      <Text variant="caption" tone="muted" style={{ flex: 1 }}>{`${name} · ${detail}`}</Text>
      <Icon icon={Phone} size={20} color={colors.accent} />
    </PressableScale>
  );
}

/** Questions as one accordion card: the first answer is open, the others one tap away. */
export default function HelpTopic() {
  useTheme();
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const t = HELP_TOPICS.find((x) => x.id === topic);
  const [open, setOpen] = useState(0);
  if (!t) return <Screen header={<Header title="Aide" onBack={() => router.back()} />}><EmptyState title="Sujet introuvable" /></Screen>;
  return (
    <Screen header={<Header title={t.title} onBack={() => router.back()} />} footer={<Button label="Ce n’est pas résolu · créer une demande" full variant="secondary" onPress={() => router.push({ pathname: '/support/new', params: { category: t.category } })} />}>
      {t.id === 'safety' ? (
        // The numbers themselves, one tap from the dialler, before any reading.
        <ListGroup label="Urgence · appel direct depuis votre téléphone" style={{ marginTop: 4, marginBottom: 24 }}>
          {EMERGENCY_NUMBERS.map((e) => (
            <EmergencyRow key={e.number} number={e.number} name={e.name} detail={e.detail} testID={`help-${e.testID}`} />
          ))}
        </ListGroup>
      ) : null}
      <View style={{ marginTop: 4, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: 16 }}>
        {t.articles.map((a, i) => {
          const expanded = open === i;
          return (
            <View key={a.q} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, paddingVertical: 8, gap: 6 }}>
              <PressableScale onPress={() => setOpen(expanded ? -1 : i)} accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }} pressedScale={0.99}>
                <Text variant="label" weight="semibold" style={{ flex: 1 }}>{a.q}</Text>
                {expanded ? <ChevronUp size={20} color={colors.muted} /> : <ChevronDown size={20} color={colors.muted} />}
              </PressableScale>
              {expanded ? <Text variant="label" tone="muted" style={{ paddingBottom: 6 }}>{a.a}</Text> : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
