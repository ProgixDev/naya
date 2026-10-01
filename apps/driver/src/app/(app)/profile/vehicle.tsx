import { View } from 'react-native';
import { router } from 'expo-router';
import { STATUS_LABELS } from '@naya/domain';
import { Button, Card, Header, ListGroup, ListRow, Screen, StatusBanner, StatusPill, Text, TextButton, VehicleImage } from '@naya/ui';
import { FigureLine } from '@/components/Kit';
import { useCases, useMe } from '@/lib/queries';
import { statusTone } from '@/components/Dossier';

/** D17 · vehicle */
export default function VehicleProfile() {
  const me = useMe();
  const { vehicle } = useCases();
  const v = me.data?.vehicle;
  return (
    <Screen header={<Header title="Mon véhicule" onBack={() => router.back()} />} testID="vehicle-profile">
      <View style={{ gap: 14, marginTop: 4 }}>
        {v ? (
          <>
            <Card style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
              <VehicleImage color={v.color} width={220} />
              <Text variant="heading">
                {v.make} {v.model}
              </Text>
              {vehicle ? <StatusPill tone={statusTone(vehicle.status)} label={STATUS_LABELS[vehicle.status]} /> : null}
              <View style={{ alignSelf: 'stretch', marginTop: 6 }}>
                <FigureLine label="Immatriculation" value={v.plate} />
                <FigureLine label="Couleur" value={v.color} />
                <FigureLine label="Année" value={String(v.year)} />
              </View>
            </Card>
            <ListGroup>
              <ListRow title="Dossier véhicule" subtitle="Carte grise, assurance, photos" onPress={() => router.push('/docs/status')} />
            </ListGroup>
            <StatusBanner compact tone="neutral" title="Changer de véhicule demande un nouvel examen" />
            <TextButton label="Contacter l’assistance" onPress={() => router.push({ pathname: '/support/new', params: { category: 'account' } })} />
          </>
        ) : (
          <Button label="Déclarer mon véhicule" size="major" full onPress={() => router.push('/docs/vehicle')} />
        )}
      </View>
    </Screen>
  );
}
