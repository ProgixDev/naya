import { TileMap } from './TileMap';
import type { NayaMapProps } from './types';

export const mapEngine = 'tiles' as const;

/** react-native-maps has no web renderer; the web build always uses the tile map. */
export function NayaMap(props: NayaMapProps) {
  return <TileMap {...props} />;
}
