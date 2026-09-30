import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from '@naya/domain';

export type LocationState = { status: 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable'; position: LatLng | null; at: number | null };

/**
 * Foreground location, requested only after the person taps "Ma position" and has seen
 * why. Denial is a normal path: the pickup is then chosen on the map.
 */
export function useForegroundLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle', position: null, at: null });
  const locate = useCallback(async (): Promise<LatLng | null> => {
    setState((s) => ({ ...s, status: 'asking' }));
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setState({ status: 'denied', position: null, at: null });
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setState({ status: 'granted', position, at: pos.timestamp });
      return position;
    } catch {
      setState({ status: 'unavailable', position: null, at: null });
      return null;
    }
  }, []);
  return { ...state, locate };
}
