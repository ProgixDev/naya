import { View } from 'react-native';
import { router } from 'expo-router';
import { STATUS_LABELS } from '@naya/domain';
import { Button, Card, Header, ListGroup, ListRow, Screen, StatusPill, Text, VehicleImage } from '@naya/ui';
import { useCases, useMe } from '@/lib/queries';
import { statusTone } from '@/components/Dossier';

/** D17 · vehicle */
export default function VehicleProfile() {
  const me = useMe();
  const { vehicle } = useCases();
  const v = me.data?.vehicle;
  return (
    <Screen header={<Header title="Mon véhicule" onBack={() => router.back()} />} testID="vehicle-profile">
      <View style={{ gap: 16, marginTop: 12 }}>
        {v ? (
          <>
            <Card style={{ alignItems: 'center', gap: 8 }}>
              <VehicleImage color={v.color} width={260} />
              <Text variant="heading">
                {v.make} {v.model} · {v.color}
              </Text>
              {vehicle ? <StatusPill tone={statusTone(vehicle.status)} label={STATUS_LABELS[vehicle.status]} /> : null}
            </Card>
            <ListGroup>
              <ListRow title="Immatriculation" value={v.plate} />
              <ListRow title="Année" value={String(v.year)} numericValue />
              <ListRow title="Dossier véhicule" subtitle="Carte grise, assurance, photos" onPress={() => router.push('/docs/status')} />
            </ListGroup>
            <Text variant="caption" tone="muted">
              Changer de véhicule demande un nouvel examen. Contactez l’assistance pour lancer la procédure.
            </Text>
            <Button label="Contacter l’assistance" variant="secondary" full onPress={() => router.push({ pathname: '/support/new', params: { category: 'account' } })} />
          </>
        ) : (
          <Button label="Déclarer mon véhicule" full onPress={() => router.push('/docs/vehicle')} />
        )}
      </View>
    </Screen>
  );
}
