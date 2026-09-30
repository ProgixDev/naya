import { View } from 'react-native';
import { router } from 'expo-router';
import { aspect, illustrations } from '@naya/assets';
import { Header, Illustration, Screen, StatusBanner, Text, Button } from '@naya/ui';
import { useCases } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { CaseChecklist } from './Dossier';

/** D04: the two independent dossiers (person, vehicle). Each is sent on its own. */
export function DossierHub({ onBack }: { onBack?: () => void }) {
  const { person, vehicle } = useCases();
  const firstVisit = !person?.identity && !vehicle;
  return (
    <Screen header={<Header title="Votre dossier chauffeuse" subtitle="Deux examens séparés : vous, puis votre véhicule." onBack={onBack} />} testID="dossier-hub">
      <View style={{ gap: 28, marginTop: 12 }}>
        {firstVisit ? <Illustration source={illustrations.driverWelcome} aspect={aspect.illustration} maxHeight={200} /> : null}
        <StatusBanner tone="neutral" title="Un examen humain" message="Vos pièces sont examinées par l’équipe Naya. Vous pourrez recevoir des courses quand la chauffeuse ET le véhicule seront approuvés." />
        <CaseChecklist kase={person} subject="driver_identity" />
        <CaseChecklist kase={vehicle} subject="vehicle" />
        <Text variant="caption" tone="muted">
          Les documents sont privés : seule l’équipe de vérification peut les consulter.
        </Text>
        {!onBack ? <Button label="Se déconnecter" variant="ghost" full onPress={() => useSession.getState().signOut()} /> : null}
        {onBack ? null : <Button label="Voir le suivi" variant="secondary" full onPress={() => router.push('/docs/status')} testID="open-status" />}
      </View>
    </Screen>
  );
}
