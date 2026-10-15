import { useTheme, Button, Header, Icon, ListGroup, ListRow, Screen, Text } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Inbox, Siren } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { HELP_TOPICS } from '@/features/help/topics';
import { EMERGENCY_NUMBERS } from '@/features/help/emergency';

/**
 * P15. Topics are text rows (P-45, A91): only the safety topic keeps a glyph, `Siren` in danger, so it
 * stands out. « Mes demandes » is a list of requests (`Inbox`, A92).
 */
export default function Help() {
  useTheme();
  return (
    <Screen testID="help" header={<Header title="Comment vous aider ?" onBack={() => router.back()} />} footer={<Button label="Créer une demande" full onPress={() => router.push('/support/new')} testID="help-new" />}>
      <View style={{ gap: 24, marginTop: 4 }}>
        <ListGroup>
          {HELP_TOPICS.map((t) => (
            <ListRow
              key={t.id}
              testID={`topic-${t.id}`}
              title={t.title}
              subtitle={t.subtitle}
              leading={t.id === 'safety' ? <Icon icon={Siren} size={24} color={colors.danger} /> : undefined}
              onPress={() => router.push({ pathname: '/help/[topic]', params: { topic: t.id } })}
            />
          ))}
        </ListGroup>
        <ListGroup>
          <ListRow testID="my-tickets" title="Mes demandes" subtitle="Consulter les réponses" leading={<Icon icon={Inbox} size={24} color={colors.ink} />} onPress={() => router.push('/support')} />
        </ListGroup>
        <Text variant="caption" tone="muted" style={{ paddingHorizontal: 4 }}>
          Une demande n’est pas un appel d’urgence. En cas de danger, appelez la police ({EMERGENCY_NUMBERS[0].number}) ou la Protection civile ({EMERGENCY_NUMBERS[1].number}).
        </Text>
      </View>
    </Screen>
  );
}
