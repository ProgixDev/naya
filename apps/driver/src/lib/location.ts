import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from '@naya/domain';
import { STANDALONE_DEMO } from '@naya/ui';

export type LocationState = 'unknown' | 'granted' | 'denied' | 'unavailable';

/** Foreground permission, asked in context (when going online), never at launch. */
export function useForegroundLocation() {
  const [state, setState] = useState<LocationState>('unknown');
  useEffect(() => {
    if (STANDALONE_DEMO) { setState('granted'); return; }
    Location.getForegroundPermissionsAsync()
      .then((p) => setState(p.granted ? 'granted' : p.canAskAgain ? 'unknown' : 'denied'))
      .catch(() => setState('unavailable'));
  }, []);
  const request = useCallback(async (): Promise<LatLng | null | 'denied'> => {
    if (STANDALONE_DEMO) return { lat: 34.0205, lng: -6.831 };
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted) {
        setState('denied');
        return 'denied';
      }
      setState('granted');
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((r) => setTimeout(() => r(null), 6000)),
      ]);
      return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
    } catch {
      setState('unavailable');
      return 'denied';
    }
  }, []);
  return { state, request };
}

const HEARTBEAT_MS = 10_000;

/**
 * Streams the driver's position to the API while online or on a ride (foreground).
 * A stationary phone produces no movement events, so the last fix is re-sent every
 * 10 s: the passenger sees "position not updated" only when the link is really lost.
 */
export function useLocationStream(active: boolean, send: (p: LatLng) => void) {
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!active || STANDALONE_DEMO) return;
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    let last: LatLng | null = null;
    const beat = setInterval(() => last && sendRef.current(last), HEARTBEAT_MS);
    Location.getForegroundPermissionsAsync()
      .then(async (p) => {
        if (!p.granted || !alive) return;
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 8000 }, (pos) => {
          last = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          sendRef.current(last);
        });
        if (!alive) sub.remove();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      clearInterval(beat);
      sub?.remove();
    };
  }, [active]);
}
