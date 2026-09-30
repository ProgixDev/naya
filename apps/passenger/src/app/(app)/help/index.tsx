import { View } from 'react-native';
import { router } from 'expo-router';
import { FileText, MessageCircle, Route as RouteIcon, ShieldAlert, Wallet } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { Button, Header, IconDisc, ListGroup, ListRow, Screen, Text } from '@naya/ui';
import { HELP_TOPICS } from '@/features/help/topics';

const ICONS = { trip: RouteIcon, payment: Wallet, account: FileText, safety: ShieldAlert } as const;

export default function Help() {
  return (
    <Screen testID="help" header={<Header title="Comment vous aider ?" onBack={() => router.back()} />} footer={<Button label="Créer une demande" full size="major" onPress={() => router.push('/support/new')} testID="help-new" />}>
      <View style={{ gap: 16, marginTop: 12 }}>
        <ListGroup>
          {HELP_TOPICS.map((t) => {
            const Icon = ICONS[t.id as keyof typeof ICONS] ?? MessageCircle;
            return <ListRow key={t.id} testID={`topic-${t.id}`} title={t.title} subtitle={t.subtitle} leading={<IconDisc tone={t.id === 'safety' ? 'danger' : 'plain'}><Icon size={18} color={t.id === 'safety' ? colors.danger : colors.accent} /></IconDisc>} onPress={() => router.push({ pathname: '/help/[topic]', params: { topic: t.id } })} />;
          })}
        </ListGroup>
        <ListGroup>
          <ListRow testID="my-tickets" title="Mes demandes" subtitle="Consulter les réponses" leading={<IconDisc><MessageCircle size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push('/support')} />
        </ListGroup>
        <Text variant="caption" tone="muted">Les réponses sont consultables ici. Aucun délai instantané n’est garanti ; les signalements de sécurité sont traités en priorité.</Text>
      </View>
    </Screen>
  );
}
