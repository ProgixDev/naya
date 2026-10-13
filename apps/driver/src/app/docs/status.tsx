import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import { useApi } from '@naya/api/react';
import { dossierOverview, type VerificationCase } from '@naya/domain';
import { Button, DEMO_MODE, Header, ListGroup, ListRow, Screen, StatusBanner, Text, toast } from '@naya/ui';
import { CaseReview } from '@/components/Dossier';
import { useSignup } from '@/components/signup/useSignup';

/** Demo only: lets a tester decide her own submitted dossier (labelled « Démo »). */
function DemoReview({ cases }: { cases: VerificationCase[] }) {
  const api = useApi();
  const { store } = useSignup();
  const decide = useMutation({
    mutationFn: ({ c, outcome }: { c: VerificationCase; outcome: 'approved' | 'more_info_requested' | 'rejected' }) => api.dev.simulateReview(c.id, outcome, c.items.find((i) => i.key !== 'selfie')?.key),
    onSuccess: (c) => {
      store(c);
      toast('Décision simulée enregistrée');
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const pending = cases.filter((c) => c.status === 'submitted' || c.status === 'in_review');
  if (!pending.length) return null;
  const name = (c: VerificationCase) => (c.subject === 'vehicle' ? 'Véhicule' : c.subject === 'driver_famille' ? 'Naya Famille' : 'Chauffeuse');
  return (
    <ListGroup label="Démo · simuler l’examen" footnote="Décision fictive prise par la réviseuse de démonstration. Aucun examen réel.">
      {pending.flatMap((c) => [
        <ListRow key={`${c.id}-a`} title={`${name(c)} · valider`} onPress={() => decide.mutate({ c, outcome: 'approved' })} testID={`demo-approve-${c.subject}`} />,
        <ListRow key={`${c.id}-m`} title={`${name(c)} · demander une reprise`} onPress={() => decide.mutate({ c, outcome: 'more_info_requested' })} testID={`demo-more-${c.subject}`} />,
        <ListRow key={`${c.id}-r`} title={`${name(c)} · refuser`} destructive onPress={() => decide.mutate({ c, outcome: 'rejected' })} testID={`demo-reject-${c.subject}`} />,
      ])}
    </ListGroup>
  );
}

/** D05: person, vehicle and (when requested) Naya Famille reviews, independent. Person and vehicle approvals are needed to receive offers. */
export default function DossierStatus() {
  const { person, vehicle, famille, data, refetch, isRefetching, ctx } = useSignup();
  const recoverable = data?.recoverableRejections ?? [];
  const both = person?.status === 'approved' && vehicle?.status === 'approved';
  const overview = dossierOverview({ person, vehicle, famille }, ctx);
  return (
    <Screen
      header={<Header title="Suivi du dossier" subtitle="Délai habituel : moins de 24 h ouvrées." onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      footer={<Button label="Actualiser" variant="secondary" size="major" full loading={isRefetching} onPress={() => refetch()} testID="refresh-status" />}
      testID="dossier-status"
    >
      <View style={{ gap: 10, marginTop: 4 }}>
        {both ? (
          <StatusBanner compact tone="success" title="Vous pouvez recevoir des courses" message="passez en ligne depuis l’accueil" testID="eligible-banner" />
        ) : (
          <StatusBanner compact tone="warning" title="Réception des courses bloquée" message="vous et le véhicule devez être approuvées" testID="blocked-banner" />
        )}
        <Text variant="micro" tone="muted" numeric>
          Dossier complété à {overview.percent} % · {overview.done} étapes sur {overview.total}
        </Text>
        <CaseReview kase={person} subject="driver_identity" recoverable={recoverable} ctx={ctx} />
        <CaseReview kase={vehicle} subject="vehicle" recoverable={recoverable} ctx={ctx} />
        {famille ? <CaseReview kase={famille} subject="driver_famille" recoverable={recoverable} ctx={ctx} /> : null}
        {!famille ? <Button label="Conduire pour Naya Famille" variant="ghost" full onPress={() => router.push('/docs/famille')} testID="status-famille" /> : null}
        {DEMO_MODE ? <DemoReview cases={[person, vehicle, famille].filter((c): c is VerificationCase => !!c)} /> : null}
      </View>
    </Screen>
  );
}
