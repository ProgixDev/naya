import { ThemePicker , Header, ListGroup, ListRow, Screen, StatusBanner, Text, TextButton, toast, useA11yPrefs, useGlassKind, Toggle } from '@naya/ui';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { NotificationPreferences } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useAccountId, useMe } from '@/lib/queries';

const ROWS: { key: keyof NotificationPreferences; title: string }[] = [
  { key: 'rideUpdates', title: 'Suivi de course' },
  { key: 'scheduledReminders', title: 'Rappels de réservation' },
  { key: 'supportReplies', title: 'Réponses de l’assistance' },
  { key: 'product', title: 'Nouveautés Naya (rares)' },
];

/** P13-settings / P13-notifications: server-side preferences + device permission asked in context. */
export default function Preferences() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const a11y = useA11yPrefs();
  const glass = useGlassKind();
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined' | 'unsupported'>(Platform.OS === 'web' ? 'unsupported' : 'undetermined');
  useEffect(() => {
    if (Platform.OS === 'web') return;
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
      <View style={{ gap: 14, marginTop: 4 }}>
        {perm === 'undetermined' ? <StatusBanner tone="neutral" title="Être prévenue à l’arrivée ?" message="Même si l’app est en arrière-plan." action={{ label: 'Autoriser les notifications', onPress: ask }} /> : null}
        {perm === 'denied' ? <StatusBanner tone="warning" title="Notifications désactivées" message="Activez-les dans les réglages du téléphone." action={{ label: 'Ouvrir les réglages', onPress: () => Linking.openSettings() }} /> : null}
        <ListGroup label="Notifications">
          {ROWS.map((r) => (
            <ListRow key={r.key} title={r.title} trailing={<Toggle value={!!n?.[r.key]} onValueChange={(v) => update.mutate({ [r.key]: v })} accessibilityLabel={r.title} testID={`pref-${r.key}`} />} />
          ))}
        </ListGroup>
        <ThemePicker />
        <ListGroup label="Affichage" footnote="Naya suit les réglages d’accessibilité du téléphone.">
          <ListRow title="Réduire les animations" value={a11y.reduceMotion ? 'Activé' : 'Désactivé'} />
          <ListRow title="Commandes flottantes" value={glass === 'opaque' ? 'Opaques' : glass === 'liquid' ? 'Verre natif' : 'Givrées'} />
          <ListRow title="Taille du texte" value={`${Math.round(a11y.fontScale * 100)} %`} numericValue />
        </ListGroup>
        <Text variant="caption" tone="muted" style={{ paddingHorizontal: 4 }}>Vos pièces d’identité sont privées (équipe de vérification uniquement). La position sert seulement app ouverte, pour le départ.</Text>
        <TextButton label="Supprimer mon compte · écrire à l’assistance" onPress={() => router.push('/support/new')} />
      </View>
    </Screen>
  );
}
