import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Header, ListGroup, ListRow, Screen, StatusIcon, Text, TextButton, VehicleImage } from '@naya/ui';
import { FigureLine } from '@/components/Kit';
import { useCases, useMe } from '@/lib/queries';

/** D17 · vehicle. The dossier state is said once, under the car (C7: glyph and word on a detail hero). */
export default function VehicleProfile() {
  const me = useMe();
  const { vehicle } = useCases();
  const v = me.data?.vehicle;
  return (
    <Screen header={<Header title="Mon véhicule" onBack={() => router.back()} />} testID="vehicle-profile">
      <View style={{ gap: 24, marginTop: 4 }}>
        {v ? (
          <>
            <Card style={{ alignItems: 'center', gap: 8, paddingTop: 8 }}>
              <VehicleImage color={v.color} width={220} />
              <Text variant="heading">
                {v.make} {v.model}
              </Text>
              {vehicle ? <StatusIcon kind="verification" state={vehicle.status} showLabel testID="vehicle-status" /> : null}
              <View style={{ alignSelf: 'stretch', marginTop: 6 }}>
                <FigureLine label="Immatriculation" value={v.plate} />
                <FigureLine label="Couleur" value={v.color} />
                <FigureLine label="Année" value={String(v.year)} />
              </View>
            </Card>
            <ListGroup footnote="Changer de véhicule demande un nouvel examen.">
              <ListRow title="Dossier véhicule" subtitle="Carte grise, assurance, photos" onPress={() => router.push('/docs/status')} testID="vehicle-dossier" />
            </ListGroup>
            <TextButton label="Contacter l’assistance" onPress={() => router.push({ pathname: '/support/new', params: { category: 'account' } })} testID="vehicle-support" />
          </>
        ) : (
          <Button label="Déclarer mon véhicule" full onPress={() => router.push('/docs/vehicle')} testID="vehicle-declare" />
        )}
      </View>
    </Screen>
  );
}
