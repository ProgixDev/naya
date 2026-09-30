import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDay, ITEM_LABELS, STATUS_LABELS } from '@naya/domain';
import { aspect, illustrations } from '@naya/assets';
import { colors } from '@naya/tokens';
import { Button, ErrorState, Header, IconDisc, Illustration, ListGroup, ListRow, Screen, SkeletonList, StatusBanner, TextButton, haptic, toast } from '@naya/ui';
import { useAccountId } from '@/lib/queries';
import { useSession } from '@/lib/session';

/**
 * P05: pending, approved, more information requested and rejected. Polls the decision;
 * approval shows a confirmation before the app opens (the guard switches on refresh).
 */
export default function Status() {
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
  const signOut = <TextButton label="Se déconnecter" tone="muted" onPress={() => useSession.getState().signOut()} />;

  if (q.isLoading) return <Screen header={<Header title="Votre dossier" />}><SkeletonList rows={2} /></Screen>;
  if (q.isError || !c) return <Screen header={<Header title="Votre dossier" />}><ErrorState onRetry={() => q.refetch()} /></Screen>;

  const received = (
    <ListGroup>
      <ListRow title={`Identité de ${c.identity?.firstName ?? 'la passagère'}`} subtitle={`${STATUS_LABELS[c.status]}${c.submittedAt ? ` le ${formatDay(c.submittedAt)}` : ''}`} leading={<IconDisc><FileText size={18} color={colors.accent} /></IconDisc>} />
    </ListGroup>
  );

  if (c.status === 'approved') {
    return (
      <Screen testID="status-approved" header={<Header title="Dossier approuvé" />} footer={<Button label="Commencer" size="major" full onPress={() => { haptic.success(); qc.invalidateQueries({ queryKey: qk.me(a) }); }} testID="start-app" />}>
        <View style={{ gap: 20, marginTop: 8 }}>
          <Illustration source={illustrations.passengerWelcome} aspect={aspect.illustration} width="86%" />
          <StatusBanner tone="success" title="Bienvenue sur Naya" message={c.decision?.message ?? 'Votre identité a été vérifiée. Vous pouvez réserver votre première course.'} />
        </View>
      </Screen>
    );
  }

  if (c.status === 'more_info_requested') {
    const fixes = c.items.filter((i) => i.status === 'needs_correction');
    return (
      <Screen testID="status-more" header={<Header title="Un complément est demandé" />} footer={<Button label="Corriger mon dossier" size="major" full onPress={() => router.push({ pathname: '/(verify)/capture/[item]', params: { item: fixes[0]?.key ?? 'id_back', correction: '1' } })} testID="fix-case" />}>
        <View style={{ gap: 16, marginTop: 8 }}>
          <StatusBanner tone="warning" title="Presque terminé" message={c.decision?.message ?? 'Une pièce doit être reprise.'} />
          <ListGroup label="À reprendre">
            {fixes.map((f) => (
              <ListRow key={f.key} title={ITEM_LABELS[f.key]} subtitle={f.note ?? undefined} onPress={() => router.push({ pathname: '/(verify)/capture/[item]', params: { item: f.key, correction: '1' } })} />
            ))}
          </ListGroup>
          {signOut}
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
        header={<Header title="Dossier non approuvé" />}
        footer={
          recoverable ? (
            <Button label="Recommencer avec une pièce valide" size="major" full loading={reopen.isPending} onPress={() => reopen.mutate(c.id)} testID="reopen-case" />
          ) : (
            <Button label="Contacter l’assistance" size="major" full onPress={() => router.push('/(verify)/support/new')} />
          )
        }
      >
        <View style={{ gap: 16, marginTop: 8 }}>
          <StatusBanner tone="danger" title={reason ?? 'Dossier refusé'} message={c.decision?.message} />
          {recoverable ? <TextButton label="Contacter l’assistance" onPress={() => router.push('/(verify)/support/new')} /> : null}
          {signOut}
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="status-pending" header={<Header title="Dossier envoyé" />} footer={<Button label="Consulter mon dossier" variant="secondary" size="major" full onPress={() => router.push('/(verify)/review')} />}>
      <View style={{ gap: 16, marginTop: 8 }}>
        <StatusBanner tone="info" title="En attente de vérification" message="Votre dossier sera examiné manuellement. Nous vous informerons de la décision ici." />
        {received}
        <StatusBanner tone="neutral" title="La réservation sera disponible après approbation." />
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>{signOut}</View>
      </View>
    </Screen>
  );
}
