import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, EmptyState, Header, Screen, Text } from '@naya/ui';
import { HELP_TOPICS } from '@/features/help/topics';

export default function HelpTopic() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const t = HELP_TOPICS.find((x) => x.id === topic);
  if (!t) return <Screen header={<Header title="Aide" onBack={() => router.back()} />}><EmptyState title="Sujet introuvable" /></Screen>;
  return (
    <Screen header={<Header title={t.title} onBack={() => router.back()} />} footer={<Button label="Ce n’est pas résolu · créer une demande" full variant="secondary" onPress={() => router.push({ pathname: '/support/new', params: { category: t.category } })} />}>
      <View style={{ gap: 12, marginTop: 12 }}>
        {t.articles.map((a) => (
          <Card key={a.q}>
            <View style={{ gap: 6 }}>
              <Text variant="label" weight="semibold">{a.q}</Text>
              <Text variant="label" tone="muted">{a.a}</Text>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
