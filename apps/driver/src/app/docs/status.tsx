import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Header, Screen, StatusBanner } from '@naya/ui';
import { useCases } from '@/lib/queries';
import { CaseReview } from '@/components/Dossier';

/** D05: person and vehicle reviews, independent. Both approvals are needed to receive offers. */
export default function DossierStatus() {
  const { person, vehicle, data, refetch, isRefetching } = useCases();
  const recoverable = data?.recoverableRejections ?? [];
  const both = person?.status === 'approved' && vehicle?.status === 'approved';
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
        <CaseReview kase={person} subject="driver_identity" recoverable={recoverable} />
        <CaseReview kase={vehicle} subject="vehicle" recoverable={recoverable} />
      </View>
    </Screen>
  );
}
