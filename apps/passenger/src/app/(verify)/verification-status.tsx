import { useTheme , Button, ErrorState, Header, ListGroup, ListRow, Screen, SkeletonList, StatusIcon, Text, TextButton, haptic, toast } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDay, ITEM_LABELS, statusPresentation, type VerificationStatus } from '@naya/domain';
import { useAccountId } from '@/lib/queries';
import { useSession } from '@/lib/session';

/**
 * P05: pending, approved, more information requested and rejected. Polls the decision;
 * approval shows a confirmation before the app opens (the guard switches on refresh).
 * The state is said once (P-10): the header names the object, the hero gives the C7 glyph in a 56 disc,
 * a 21/600 title and one grey line, with no card. Secondary actions are text (principle 1).
 */
export default function Status() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const q = useQuery({ queryKey: qk.verification(a), queryFn: api.verification.list, refetchInterval: 5000 });
  const reopen = useMutation({
    mutationFn: (id: string) => api.verification.reopen(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.me(a) });
      router.replace('/(verify)/identity');
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const c = q.data?.cases.find((x) => x.subject === 'passenger_identity');
  const signOut = <TextButton label="Se déconnecter" tone="muted" onPress={() => useSession.getState().signOut()} testID="status-sign-out" />;
  const support = <TextButton label="Contacter l’assistance" onPress={() => router.push('/(verify)/support/new')} testID="status-support" />;
  const header = <Header title="Votre dossier" />;

  if (q.isLoading) return <Screen header={header}><SkeletonList rows={2} /></Screen>;
  if (q.isError || !c) return <Screen header={header}><ErrorState onRetry={() => q.refetch()} /></Screen>;

  if (c.status === 'approved') {
    return (
      <Screen testID="status-approved" header={header} footer={<Button label="Commencer" full onPress={() => { haptic.success(); qc.invalidateQueries({ queryKey: qk.me(a) }); }} testID="start-app" />}>
        <StatusHero state="approved" title="Bienvenue sur Naya" message={c.decision?.message ?? 'Votre identité a été vérifiée. Vous pouvez réserver votre première course.'} />
      </Screen>
    );
  }

  if (c.status === 'more_info_requested') {
    const fixes = c.items.filter((i) => i.status === 'needs_correction');
    return (
      <Screen testID="status-more" header={header} footer={<><Button label="Corriger mon dossier" full onPress={() => router.push({ pathname: '/(verify)/capture/[item]', params: { item: fixes[0]?.key ?? 'id_back', correction: '1' } })} testID="fix-case" />{signOut}</>}>
        <StatusHero state="more_info_requested" title="Un complément est demandé" message={c.decision?.message ?? 'Une pièce doit être reprise.'} />
        <View style={{ marginTop: 24 }}>
          <ListGroup label="À reprendre">
            {fixes.map((f) => (
              <ListRow key={f.key} title={ITEM_LABELS[f.key]} subtitle={f.note ?? undefined} onPress={() => router.push({ pathname: '/(verify)/capture/[item]', params: { item: f.key, correction: '1' } })} testID={`fix-${f.key}`} />
            ))}
          </ListGroup>
        </View>
      </Screen>
    );
  }

  if (c.status === 'rejected') {
    const recoverable = q.data?.recoverableRejections.includes(c.decision?.reasonCode ?? '');
    const reason = q.data?.rejectionReasons.find((r) => r.code === c.decision?.reasonCode)?.label;
    return (
      <Screen
        testID="status-rejected"
        header={header}
        footer={
          <>
            {recoverable ? (
              <Button label="Recommencer avec une pièce valide" full loading={reopen.isPending} onPress={() => reopen.mutate(c.id)} testID="reopen-case" />
            ) : (
              <Button label="Contacter l’assistance" full onPress={() => router.push('/(verify)/support/new')} testID="status-support" />
            )}
            {recoverable ? support : null}
            {signOut}
          </>
        }
      >
        <StatusHero state="rejected" title={reason ?? 'Dossier refusé'} message={c.decision?.message ?? ''} />
      </Screen>
    );
  }

  // draft (reached only by a deep link), submitted, in_review
  const sent = c.submittedAt ? `Envoyé le ${formatDay(c.submittedAt)}. ` : '';
  return (
    <Screen testID="status-pending" header={header} footer={<><Button label="Consulter mon dossier" variant="secondary" full onPress={() => router.push('/(verify)/review')} testID="view-dossier" />{signOut}</>}>
      {c.status === 'in_review' ? (
        <StatusHero state="in_review" title="Vérification en cours" message={`${sent}Une personne de l’équipe Naya examine vos documents. Vous pourrez réserver dès l’approbation.`} />
      ) : (
        <StatusHero state={c.status} title="En attente de vérification" message={`${sent}Une personne de l’équipe Naya va examiner vos documents, en général en moins de 24 h. Vous pourrez réserver dès l’approbation.`} />
      )}
    </Screen>
  );
}

/**
 * The decision hero (A101, A102): the C7 glyph in a 56 disc (submitted `Send`, in review `ScanSearch`, approved
 * `BadgeCheck`, complement `FileExclamationPoint`, refused `CircleX`), then the title and one line. The disc is read
 * as the state's sentence unless the title already says it.
 */
function StatusHero({ state, title, message }: { state: VerificationStatus; title: string; message: string }) {
  useTheme();
  const p = statusPresentation('verification', state);
  return (
    <View style={{ gap: 12, marginTop: 16, alignItems: 'flex-start' }} testID="status-hero">
      <StatusIcon kind="verification" state={state} size="lg" variant="disc" showLabel={false} accessible={p.label !== title} testID="status-hero-icon" />
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="label" weight="regular" tone="muted" style={{ lineHeight: 22 }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
