import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { resolveApiBase, STANDALONE_DEMO } from '@naya/ui';

/**
 * Background location is used only while a ride is accepted (pickup and trip) so the
 * passenger sees the car even when the phone is locked. It requires a development or
 * production build (not Expo Go) with the background location config in app.config.ts,
 * and "Always" permission granted in context. It stops at completion or cancellation.
 */
export const RIDE_LOCATION_TASK = 'naya-driver-ride-location';

if (!STANDALONE_DEMO && Platform.OS !== 'web' && !TaskManager.isTaskDefined(RIDE_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RIDE_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const last = data.locations[data.locations.length - 1]!;
    try {
      const raw = await SecureStore.getItemAsync('naya.driver.session');
      if (!raw) return;
      const { token } = JSON.parse(raw) as { token: string };
      await fetch(`${resolveApiBase()}/driver/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ location: { lat: last.coords.latitude, lng: last.coords.longitude }, heading: last.coords.heading ?? null }),
      });
    } catch {
      // Network loss is surfaced to the passenger as stale tracking; nothing to do here.
    }
  });
}

export type BackgroundResult = 'started' | 'unsupported' | 'denied' | 'foreground-only';

export async function startRideTracking(): Promise<BackgroundResult> {
  if (STANDALONE_DEMO) return 'unsupported';
  if (Platform.OS === 'web') return 'unsupported';
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) return 'denied';
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return 'foreground-only';
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK)) return 'started';
    await Location.startLocationUpdatesAsync(RIDE_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 15,
      timeInterval: 5000,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: { notificationTitle: 'Course Naya en cours', notificationBody: 'Votre position est partagée avec la passagère jusqu’à la fin de la course.', notificationColor: '#6B3657' },
    });
    return 'started';
  } catch {
    return 'foreground-only';
  }
}

export async function stopRideTracking() {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(RIDE_LOCATION_TASK);
  } catch {
    // Already stopped.
  }
}
