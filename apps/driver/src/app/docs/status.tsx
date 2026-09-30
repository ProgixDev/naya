import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Header, Screen, StatusBanner, Text } from '@naya/ui';
import { useCases } from '@/lib/queries';
import { CaseReview } from '@/components/Dossier';

/** D05: person and vehicle reviews, independent. Both approvals are needed to receive offers. */
export default function DossierStatus() {
  const { person, vehicle, data, refetch, isRefetching } = useCases();
  const recoverable = data?.recoverableRejections ?? [];
  const both = person?.status === 'approved' && vehicle?.status === 'approved';
  return (
    <Screen header={<Header title="Suivi du dossier" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />} testID="dossier-status">
      <View style={{ gap: 16, marginTop: 12 }}>
        <CaseReview kase={person} subject="driver_identity" recoverable={recoverable} />
        <CaseReview kase={vehicle} subject="vehicle" recoverable={recoverable} />
        {both ? (
          <StatusBanner tone="success" title="Vous pouvez recevoir des courses" message="Passez en ligne depuis l’accueil quand vous êtes prête." testID="eligible-banner" />
        ) : (
          <StatusBanner tone="warning" title="Réception des courses bloquée" message="La chauffeuse et le véhicule doivent tous deux être approuvés pour passer en ligne." testID="blocked-banner" />
        )}
        <Button label="Actualiser" variant="secondary" full loading={isRefetching} onPress={() => refetch()} />
        <Text variant="caption" tone="muted" align="center">
          Délai habituel : moins de 24 heures ouvrées.
        </Text>
      </View>
    </Screen>
  );
}
