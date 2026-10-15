import { ThemePicker , Button, Header, ListGroup, ListRow, Screen, Sheet, StatusBanner, Text, TextButton, haptic, toast, useA11yPrefs, useGlassKind, useSingleFlight, Toggle } from '@naya/ui';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Linking, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { NotificationPreferences } from '@naya/domain';
import { useAccountId, useMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useDraft } from '@/lib/draft';

const ROWS: { key: keyof NotificationPreferences; title: string }[] = [
  { key: 'rideUpdates', title: 'Suivi de course' },
  { key: 'scheduledReminders', title: 'Rappels de réservation' },
  { key: 'supportReplies', title: 'Réponses de l’assistance' },
  { key: 'product', title: 'Nouveautés Naya (rares)' },
];

/** What POST /me/deletion does (services/demo-api/src/services/auth.ts `deleteAccount`). Keep both in step. */
const DELETION_SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: 'Effacé',
    lines: [
      'Votre nom, votre numéro de téléphone et vos adresses enregistrées',
      'Vos pièces d’identité et votre photo de vérification',
      'Vos cartes enregistrées et vos préférences de notification',
      'Les fiches de vos enfants et les proches invités dans Naya Famille',
    ],
  },
  {
    title: 'Annulé',
    lines: ['Vos courses programmées, sans frais', 'Vos trajets Naya Famille à venir et votre abonnement'],
  },
  {
    title: 'Conservé, sans votre nom',
    lines: ['Vos courses, paiements et reçus, pour nos obligations comptables et légales', 'Vos échanges avec l’assistance et les alertes de sécurité'],
  },
];

/**
 * In-app account deletion (App Store 5.1.1(v), PRD-35): explanation first, then a separate confirmation.
 * The server refuses while a ride, a Famille trip, an SOS or a payment is under way; its reason is shown here.
 */
function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [step, setStep] = useState<'explain' | 'confirm'>('explain');
  const [refusal, setRefusal] = useState<string | null>(null);
  const remove = useSingleFlight((_v: void, key: string) => api.me.deleteAccount(key), {
    onSuccess: async () => {
      haptic.success();
      setStep('explain');
      onClose();
      qc.removeQueries({ queryKey: qk.root });
      useDraft.getState().reset();
      await useSession.getState().signOut();
      toast('Votre compte a été supprimé.');
    },
    onError: (e) => {
      haptic.error();
      const message = errorMessage(e);
      setRefusal(message);
      // The banner appears inside the sheet; VoiceOver would not read it on its own.
      AccessibilityInfo.announceForAccessibility(`Suppression impossible pour l’instant. ${message}`);
    },
  });
  const close = () => {
    if (remove.isPending) return;
    setStep('explain');
    setRefusal(null);
    remove.reset();
    onClose();
  };
  const confirming = step === 'confirm';
  return (
    <Sheet
      visible={visible}
      onClose={close}
      dismissible={!remove.isPending}
      title={confirming ? 'Confirmer la suppression' : 'Supprimer votre compte'}
      subtitle={confirming ? undefined : 'Rien n’est supprimé avant votre confirmation.'}
      testID="delete-account-sheet"
      footer={
        confirming ? (
          <>
            <Button label="Supprimer définitivement" variant="danger" full loading={remove.isPending} onPress={() => { setRefusal(null); remove.run(); }} testID="delete-account-confirm" />
            <Button label="Garder mon compte" variant="secondary" full disabled={remove.isPending} onPress={close} testID="delete-account-keep" />
          </>
        ) : (
          <>
            <Button label="Continuer" variant="secondary" full onPress={() => setStep('confirm')} testID="delete-account-continue" />
            <TextButton label="Garder mon compte" tone="muted" onPress={close} testID="delete-account-cancel" />
          </>
        )
      }
    >
      {confirming ? (
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          <Text variant="body">La suppression est immédiate et définitive : nous ne pourrons pas récupérer votre compte.</Text>
          <Text variant="caption" tone="muted">Vous serez déconnectée sur tous vos appareils.</Text>
          {refusal ? <StatusBanner tone="warning" title="Suppression impossible pour l’instant" message={refusal} testID="delete-account-refusal" /> : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {DELETION_SECTIONS.map((section) => (
            <View key={section.title} style={{ gap: 6 }}>
              <Text variant="label" weight="semibold" accessibilityRole="header">{section.title}</Text>
              {section.lines.map((line) => (
                <Text key={line} variant="caption" tone="muted">{`•  ${line}`}</Text>
              ))}
            </View>
          ))}
          <Text variant="caption" tone="muted">Avec le même numéro, vous pourrez ouvrir un nouveau compte ; il faudra de nouveau vérifier votre identité.</Text>
        </ScrollView>
      )}
    </Sheet>
  );
}

/** P13-settings / P13-notifications: server-side preferences + device permission asked in context. */
export default function Preferences() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const a11y = useA11yPrefs();
  const glass = useGlassKind();
  const [deleting, setDeleting] = useState(false);
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
        <ListGroup label="Compte" footnote="Définitif. Vos courses et paiements sont conservés, sans votre nom.">
          <ListRow title="Supprimer mon compte" destructive onPress={() => setDeleting(true)} accessibilityHint="Explique ce qui est effacé avant de vous demander confirmation" testID="delete-account" />
        </ListGroup>
      </View>
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />
    </Screen>
  );
}
