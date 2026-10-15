import { useTheme, ThemePicker, Button, Header, ListGroup, ListRow, Screen, Sheet, StatusBanner, Text, TextButton, Toggle, haptic, toast, useSingleFlight } from '@naya/ui';
import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { NotificationPreferences } from '@naya/domain';
import { useAccountId, useMe } from '@/lib/queries';
import { useSession } from '@/lib/session';

const ROWS: { key: keyof NotificationPreferences; title: string; subtitle: string }[] = [
  { key: 'offers', title: 'Nouvelles propositions', subtitle: 'Alerte quand l’application est en arrière-plan' },
  { key: 'rideUpdates', title: 'Suivi des courses', subtitle: 'Annulations et changements' },
  { key: 'supportReplies', title: 'Réponses de l’assistance', subtitle: 'Vos demandes en cours' },
  { key: 'product', title: 'Nouveautés Naya', subtitle: 'Au plus une fois par mois' },
];

/** What POST /me/deletion does for a chauffeuse (services/demo-api/src/services/auth.ts `deleteAccount`). Keep both in step. */
const DELETION_SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: 'Avant de supprimer',
    lines: ['Être hors ligne, sans course ni trajet Naya Famille en cours', 'Un portefeuille à 0 MAD : retirez votre solde ou réglez votre dette, ou contactez l’assistance'],
  },
  {
    title: 'Effacé',
    lines: [
      'Votre nom, votre numéro de téléphone et vos préférences de notification',
      'Vos pièces d’identité, votre permis, votre selfie et les documents du véhicule',
      'Vos comptes bancaires de retrait et l’immatriculation enregistrée',
    ],
  },
  {
    title: 'Conservé, sans votre nom',
    lines: [
      'Les courses effectuées, pour les reçus des passagères et la sécurité',
      'Votre portefeuille, vos gains, recharges et retraits, pour nos obligations comptables et légales',
      'Vos échanges avec l’assistance et les alertes de sécurité',
    ],
  },
];

/** Refusals the chauffeuse settles with the assistance: money on or owed to the wallet, families relying on her. */
const ASK_SUPPORT = ['wallet_balance', 'wallet_debt', 'famille_assignments'];

/**
 * In-app account deletion for a chauffeuse (PRD-35, mirrors the passenger flow of ADR-0055): explanation
 * first, then a separate confirmation. The server refuses during a ride, while she is online, while money
 * moves, or with a balance or a debt; its reason shows here, with « Contacter l’assistance » when she
 * cannot settle it alone. Toasts render behind sheets (UI-07), so the refusal is a banner, announced.
 */
function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [step, setStep] = useState<'explain' | 'confirm'>('explain');
  const [refusal, setRefusal] = useState<{ message: string; support: boolean } | null>(null);
  const remove = useSingleFlight((_v: void, key: string) => api.me.deleteAccount(key), {
    onSuccess: async () => {
      haptic.success();
      setStep('explain');
      onClose();
      qc.removeQueries({ queryKey: qk.root });
      await useSession.getState().signOut();
      toast('Votre compte a été supprimé.', 'success');
    },
    onError: (e) => {
      haptic.error();
      const message = errorMessage(e);
      const blockers = isApiError(e) && Array.isArray(e.details?.blockers) ? (e.details.blockers as string[]) : [];
      setRefusal({ message, support: blockers.some((b) => ASK_SUPPORT.includes(b)) });
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
  const askSupport = () => {
    close();
    router.push({ pathname: '/support/new', params: { category: 'account' } });
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
        <View style={{ gap: 12, paddingBottom: 4 }}>
          <Text variant="body">La suppression est immédiate et définitive : nous ne pourrons pas récupérer votre compte.</Text>
          <Text variant="caption" tone="muted">Vous serez déconnectée sur tous vos appareils et ne recevrez plus de propositions.</Text>
          {refusal ? (
            <StatusBanner
              tone="warning"
              title="Suppression impossible pour l’instant"
              message={refusal.message}
              action={refusal.support ? { label: 'Contacter l’assistance', onPress: askSupport } : undefined}
              testID="delete-account-refusal"
            />
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 16, paddingBottom: 4 }}>
          {DELETION_SECTIONS.map((section) => (
            <View key={section.title} style={{ gap: 6 }}>
              <Text variant="label" weight="semibold" accessibilityRole="header">
                {section.title}
              </Text>
              {section.lines.map((line) => (
                <Text key={line} variant="caption" tone="muted">{`•  ${line}`}</Text>
              ))}
            </View>
          ))}
          <Text variant="caption" tone="muted">Avec le même numéro, vous pourrez ouvrir un nouveau compte ; il faudra de nouveau envoyer votre dossier.</Text>
        </View>
      )}
    </Sheet>
  );
}

/** D17-settings. Shared `Toggle` (VIS-15); the system settings are followed, not mirrored as read-only rows (D-31, P-36). */
export default function Preferences() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const [deleting, setDeleting] = useState(false);
  const update = useMutation({
    mutationFn: (n: Partial<NotificationPreferences>) => api.me.update({ notifications: n }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const n = me.data?.user.notifications;
  return (
    <Screen header={<Header title="Préférences" onBack={() => router.back()} />} testID="preferences">
      <View style={{ gap: 24, marginTop: 4 }}>
        <ListGroup label="Notifications">
          {ROWS.map((r) => (
            <ListRow key={r.key} title={r.title} subtitle={r.subtitle} trailing={<Toggle value={!!n?.[r.key]} onValueChange={(v) => update.mutate({ [r.key]: v })} accessibilityLabel={r.title} testID={`pref-${r.key}`} />} />
          ))}
        </ListGroup>
        <ThemePicker footnote="Naya suit les réglages d’accessibilité de votre téléphone (taille du texte, animations, transparence)." />
        <ListGroup label="Compte" footnote="Définitif. Les courses effectuées et vos opérations sont conservées, sans votre nom.">
          <ListRow title="Supprimer mon compte" destructive onPress={() => setDeleting(true)} accessibilityHint="Explique ce qui est effacé avant de vous demander confirmation" testID="delete-account" />
        </ListGroup>
        <Text variant="caption" tone="muted" align="center">
          Français · Africa/Casablanca
        </Text>
      </View>
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />
    </Screen>
  );
}
