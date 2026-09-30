import { useEffect, useState } from 'react';
import { Linking, Platform, Switch, View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { NotificationPreferences } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Header, ListGroup, ListRow, Screen, StatusBanner, Text, toast, useA11yPrefs, useGlassKind } from '@naya/ui';
import { useAccountId, useMe } from '@/lib/queries';

const ROWS: { key: keyof NotificationPreferences; title: string; subtitle: string }[] = [
  { key: 'rideUpdates', title: 'Suivi de course', subtitle: 'Chauffeuse attribuée, arrivée, fin de trajet' },
  { key: 'scheduledReminders', title: 'Rappels de réservation', subtitle: 'Avant un départ planifié' },
  { key: 'supportReplies', title: 'Réponses de l’assistance', subtitle: 'Quand l’équipe vous répond' },
  { key: 'product', title: 'Nouveautés Naya', subtitle: 'Rarement, jamais publicitaire' },
];

/** P13-settings / P13-notifications: server-side preferences + device permission asked in context. */
export default function Preferences() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const a11y = useA11yPrefs();
  const glass = useGlassKind();
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined' | 'unsupported'>('undetermined');
  useEffect(() => {
    if (Platform.OS === 'web') return setPerm('unsupported');
    Notifications.getPermissionsAsync().then((p) => setPerm(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied')).catch(() => setPerm('unsupported'));
  }, []);
  const update = useMutation({
    mutationFn: (n: Partial<NotificationPreferences>) => api.me.update({ notifications: n }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const ask = async () => {
    const r = await Notifications.requestPermissionsAsync();
    setPerm(r.granted ? 'granted' : 'denied');
  };
  const n = me.data?.user.notifications;
  return (
    <Screen testID="preferences" header={<Header title="Préférences" onBack={() => router.back()} />}>
      <View style={{ gap: 20, marginTop: 12 }}>
        {perm === 'undetermined' ? <StatusBanner tone="neutral" title="Recevoir l’arrivée de votre chauffeuse ?" message="Nous vous prévenons quand elle arrive, même si l’app est en arrière-plan." action={{ label: 'Autoriser les notifications', onPress: ask }} /> : null}
        {perm === 'denied' ? <StatusBanner tone="warning" title="Notifications désactivées" message="Activez-les dans les réglages du téléphone pour être prévenue de l’arrivée." action={{ label: 'Ouvrir les réglages', onPress: () => Linking.openSettings() }} /> : null}
        {perm === 'unsupported' ? <StatusBanner tone="info" title="Notifications indisponibles ici" message="Les notifications fonctionnent sur l’app iOS et Android (build de développement)." /> : null}
        <ListGroup label="Notifications">
          {ROWS.map((r) => (
            <ListRow key={r.key} title={r.title} subtitle={r.subtitle} trailing={<Switch value={!!n?.[r.key]} onValueChange={(v) => update.mutate({ [r.key]: v })} trackColor={{ true: colors.accent, false: colors.line }} accessibilityLabel={r.title} testID={`pref-${r.key}`} />} />
          ))}
        </ListGroup>
        <ListGroup label="Affichage" footnote="Naya suit les réglages d’accessibilité du téléphone : réduction des animations et de la transparence, taille du texte.">
          <ListRow title="Réduire les animations" value={a11y.reduceMotion ? 'Activé' : 'Désactivé'} />
          <ListRow title="Matériau des commandes flottantes" value={glass === 'opaque' ? 'Opaque' : glass === 'liquid' ? 'Verre natif' : 'Givré'} />
          <ListRow title="Taille du texte" value={`${Math.round(a11y.fontScale * 100)} %`} numericValue />
        </ListGroup>
        <ListGroup label="Confidentialité">
          <ListRow title="Vos pièces d’identité" subtitle="Privées, consultables uniquement par l’équipe de vérification" />
          <ListRow title="Position" subtitle="Utilisée seulement pendant l’app ouverte, pour le point de départ" />
        </ListGroup>
        <Text variant="caption" tone="muted">Pour supprimer votre compte, écrivez à l’assistance depuis Aide et demandes.</Text>
        <Button label="Contacter l’assistance" variant="ghost" full onPress={() => router.push('/support/new')} />
      </View>
    </Screen>
  );
}
