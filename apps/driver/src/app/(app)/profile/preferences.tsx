import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { NotificationPreferences } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Header, ListGroup, ListRow, Screen, Text, toast, useA11yPrefs, useGlassKind } from '@naya/ui';
import { useAccountId, useMe } from '@/lib/queries';

const ROWS: { key: keyof NotificationPreferences; title: string; subtitle: string }[] = [
  { key: 'offers', title: 'Nouvelles propositions', subtitle: 'Alerte quand l’application est en arrière-plan' },
  { key: 'rideUpdates', title: 'Suivi des courses', subtitle: 'Annulations et changements' },
  { key: 'supportReplies', title: 'Réponses de l’assistance', subtitle: 'Vos demandes en cours' },
  { key: 'product', title: 'Nouveautés Naya', subtitle: 'Au plus une fois par mois' },
];

/** D17-settings */
export default function Preferences() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const prefs = useA11yPrefs();
  const glass = useGlassKind();
  const update = useMutation({
    mutationFn: (n: Partial<NotificationPreferences>) => api.me.update({ notifications: n }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const n = me.data?.user.notifications;
  return (
    <Screen header={<Header title="Préférences" onBack={() => router.back()} />} testID="preferences">
      <View style={{ gap: 24, marginTop: 12 }}>
        <ListGroup label="Notifications">
          {ROWS.map((r) => (
            <ListRow key={r.key} title={r.title} subtitle={r.subtitle} trailing={<Switch value={!!n?.[r.key]} onValueChange={(v) => update.mutate({ [r.key]: v })} trackColor={{ true: colors.accent, false: colors.line }} accessibilityLabel={r.title} testID={`pref-${r.key}`} />} />
          ))}
        </ListGroup>
        <ListGroup label="Affichage (réglages du système)" footnote="Naya suit automatiquement les réglages d’accessibilité de votre téléphone.">
          <ListRow title="Réduire les animations" value={prefs.reduceMotion ? 'Activé' : 'Désactivé'} />
          <ListRow title="Réduire la transparence" value={glass === 'opaque' ? 'Surfaces opaques' : 'Verre dépoli'} />
          <ListRow title="Taille du texte" value={`${Math.round(prefs.fontScale * 100)} %`} numericValue />
        </ListGroup>
        <Text variant="caption" tone="muted">
          Langue : français. Fuseau horaire : Africa/Casablanca.
        </Text>
      </View>
    </Screen>
  );
}
