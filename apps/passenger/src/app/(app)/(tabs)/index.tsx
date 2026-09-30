import { NayaMap } from '@naya/ui';
import { PLACES } from '@naya/domain';
import { View } from 'react-native';

export default function Home() {
  return (
    <View style={{ flex: 1 }}>
      <NayaMap center={PLACES.centreVille.location} markers={[{ id: 'p', kind: 'pickup', coordinate: PLACES.centreVille.location }]} />
    </View>
  );
}
