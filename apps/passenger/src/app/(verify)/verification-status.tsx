import { useTheme , Button, ErrorState, Header, IconDisc, Illustration, ListGroup, ListRow, Screen, SkeletonList, StatusBanner, Text, TextButton, haptic, toast } from '@naya/ui';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CircleAlert, Clock3, FileText, XCircle } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatDay, ITEM_LABELS, STATUS_LABELS } from '@naya/domain';
import { aspect, illustrations } from '@naya/assets';
import { colors, themedStyles } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';
import { useSession } from '@/lib/session';

/**
 * P05: pending, approved, more information requested and rejected. Polls the decision;
 * approval shows a confirmation before the app opens (the guard switches on refresh).
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
  const signOut = <TextButton label="Se déconnecter" tone="muted" onPress={() => useSession.getState().signOut()} />;

  if (q.isLoading) return <Screen header={<Header title="Votre dossier" />}><SkeletonList rows={2} /></Screen>;
  if (q.isError || !c) return <Screen header={<Header title="Votre dossier" />}><ErrorState onRetry={() => q.refetch()} /></Screen>;

  const received = (
    <ListGroup>
      <ListRow title={`Identité de ${c.identity?.firstName ?? 'la passagère'}`} subtitle={`${STATUS_LABELS[c.status]}${c.submittedAt ? ` le ${formatDay(c.submittedAt)}` : ''}`} leading={<IconDisc><FileText size={18} color={colors.accent} /></IconDisc>} onPress={() => router.push('/(verify)/review')} />
    </ListGroup>
  );

  if (c.status === 'approved') {
    return (
      <Screen testID="status-approved" header={<Header title="Dossier approuvé" subtitle="Votre identité a été vérifiée." />} footer={<Button label="Commencer" size="major" full onPress={() => { haptic.success(); qc.invalidateQueries({ queryKey: qk.me(a) }); }} testID="start-app" />}>
        <View style={{ gap: 16, marginTop: 12 }}>
          <Illustration source={illustrations.passengerWelcome} aspect={aspect.illustration} width="78%" maxHeight={240} />
          <StatusHero tone="success" Icon={BadgeCheck} title="Bienvenue sur Naya" message={c.decision?.message ?? 'Vous pouvez réserver votre première course.'} />
        </View>
      </Screen>
    );
  }

  if (c.status === 'more_info_requested') {
    const fixes = c.items.filter((i) => i.status === 'needs_correction');
    return (
      <Screen testID="status-more" header={<Header title="Un complément est demandé" />} footer={<><Button label="Corriger mon dossier" size="major" full onPress={() => router.push({ pathname: '/(verify)/capture/[item]', params: { item: fixes[0]?.key ?? 'id_back', correction: '1' } })} testID="fix-case" />{signOut}</>}>
        <View style={{ gap: 14, marginTop: 14 }}>
          <StatusHero tone="warning" Icon={CircleAlert} title="Presque terminé" message={c.decision?.message ?? 'Une pièce doit être reprise.'} />
          <ListGroup label="À reprendre">
            {fixes.map((f) => (
              <ListRow key={f.key} title={ITEM_LABELS[f.key]} subtitle={f.note ?? undefined} onPress={() => router.push({ pathname: '/(verify)/capture/[item]', params: { item: f.key, correction: '1' } })} />
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
        header={<Header title="Dossier non approuvé" />}
        footer={
          <>
            {recoverable ? (
              <Button label="Recommencer avec une pièce valide" size="major" full loading={reopen.isPending} onPress={() => reopen.mutate(c.id)} testID="reopen-case" />
            ) : (
              <Button label="Contacter l’assistance" size="major" full onPress={() => router.push('/(verify)/support/new')} />
            )}
            {recoverable ? <Button label="Contacter l’assistance" variant="secondary" full onPress={() => router.push('/(verify)/support/new')} /> : null}
            {signOut}
          </>
        }
      >
        <View style={{ marginTop: 14 }}>
          <StatusHero tone="danger" Icon={XCircle} title={reason ?? 'Dossier refusé'} message={c.decision?.message ?? ''} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="status-pending" header={<Header title="Dossier envoyé" />} footer={<><Button label="Consulter mon dossier" variant="secondary" full onPress={() => router.push('/(verify)/review')} />{signOut}</>}>
      <View style={{ gap: 14, marginTop: 14 }}>
        <StatusHero tone="info" Icon={Clock3} title="En attente de vérification" message="Une personne de l’équipe Naya l’examine. Délai habituel : moins de 24 h." />
        {received}
        <StatusBanner compact tone="neutral" title="Réservation disponible après approbation" />
      </View>
    </Screen>
  );
}

// Recomputed on each read so colours follow the active theme (light / dark).
const toneColors = themedStyles(() => ({
  info: { bg: colors.infoSoft, fg: colors.info },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
} as const));

/** One card per decision: tone disc, title, one line. */
function StatusHero({ tone, Icon, title, message }: { tone: keyof typeof toneColors; Icon: typeof Clock3; title: string; message: string }) {
  useTheme();
  const t = toneColors[tone];
  return (
    <View accessible accessibilityRole="summary" style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 10, borderWidth: 1, borderColor: 'rgba(46,32,44,0.06)' }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} color={t.fg} />
      </View>
      <Text variant="heading">{title}</Text>
      {message ? <Text variant="label" tone="muted">{message}</Text> : null}
    </View>
  );
}
