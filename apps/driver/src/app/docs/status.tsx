import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { dossierOverview } from '@naya/domain';
import { Button, Header, Screen, StatusBanner, Text } from '@naya/ui';
import { CaseReview } from '@/components/Dossier';
import { useSignup } from '@/components/signup/useSignup';

/** How often the screen asks for the reviewer's decision while a dossier is being examined. */
const POLL_MS = 5000;

/**
 * D05: person, vehicle and (when requested) Naya Famille reviews, independent. Person and vehicle
 * approvals are needed to receive offers. While a dossier waits for review the screen polls, so the
 * decision shows up without pulling to refresh.
 */
export default function DossierStatus() {
  const { person, vehicle, famille, data, refetch, ctx } = useSignup();
  /** Only a tap on « Actualiser » shows the spinner; background polling stays silent. */
  const [refreshing, setRefreshing] = useState(false);
  const recoverable = data?.recoverableRejections ?? [];
  const waiting = [person, vehicle, famille].some((c) => c?.status === 'submitted' || c?.status === 'in_review');
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, refetch]);
  const both = person?.status === 'approved' && vehicle?.status === 'approved';
  const overview = dossierOverview({ person, vehicle, famille }, ctx);
  return (
    <Screen
      header={<Header title="Suivi du dossier" subtitle="Délai habituel : moins de 24 h ouvrées." onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      footer={<Button label="Actualiser" variant="secondary" size="major" full loading={refreshing} onPress={() => { setRefreshing(true); void refetch().finally(() => setRefreshing(false)); }} testID="refresh-status" />}
      testID="dossier-status"
    >
      <View style={{ gap: 10, marginTop: 4 }}>
        {both ? (
          <StatusBanner compact tone="success" title="Vous pouvez recevoir des courses" message="passez en ligne depuis l’accueil" testID="eligible-banner" />
        ) : (
          <StatusBanner compact tone="warning" title="Réception des courses bloquée" message="votre dossier et celui du véhicule doivent être approuvés" testID="blocked-banner" />
        )}
        <Text variant="micro" tone="muted" numeric>
          Dossier complété à {overview.percent} % · {overview.done} étapes sur {overview.total}
        </Text>
        <CaseReview kase={person} subject="driver_identity" recoverable={recoverable} ctx={ctx} />
        <CaseReview kase={vehicle} subject="vehicle" recoverable={recoverable} ctx={ctx} />
        {famille ? <CaseReview kase={famille} subject="driver_famille" recoverable={recoverable} ctx={ctx} /> : null}
        {!famille ? <Button label="Conduire pour Naya Famille" variant="ghost" full onPress={() => router.push('/docs/famille')} testID="status-famille" /> : null}
      </View>
    </Screen>
  );
}
