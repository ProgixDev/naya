import type { LatLng } from '@naya/domain';

export type MarkerKind = 'pickup' | 'stop' | 'destination' | 'driver' | 'me';

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  coordinate: LatLng;
  label?: string;
  /** Degrees, for the driver car. */
  heading?: number;
}

export interface NayaMapProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  route?: LatLng[];
  /** Fit the camera to these points (route and markers) when they change. */
  fitTo?: LatLng[];
  /** Manual pickup: a fixed pin at the centre; the map reports its centre when it stops moving. */
  onCenterChange?: (center: LatLng) => void;
  onPress?: (point: LatLng) => void;
  interactive?: boolean;
  /** Extra bottom padding so fitted content is not hidden under a sheet. */
  bottomInset?: number;
  topInset?: number;
  testID?: string;
}

export const DEFAULT_ZOOM = 14;
