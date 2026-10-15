import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { createApiClient, isApiError } from '@naya/api';
import { resolveApiBase, STANDALONE_DEMO } from '@naya/ui';

/**
 * Background location is used only while a ride is accepted (pickup and trip) so the
 * passenger sees the car even when the phone is locked. It requires a development or
 * production build (not Expo Go) with the background location config in app.config.ts.
 * Its lifecycle follows the server's active ride ((app)/_layout), not the ride screen; it also
 * stops at sign-out (lib/session) and stops itself when the server reports the ride is over,
 * the driver offline or the session gone.
 *
 * « Always » is never requested on its own (DRV-16): startRideTracking() only starts the task
 * when the permission is already granted. While it can still be asked, it returns
 * 'needs-consent' and the ride screen shows BackgroundLocationExplainer, which calls
 * requestRideBackgroundLocation() only after the driver accepts. Refused: foreground-only.
 */
export const RIDE_LOCATION_TASK = 'naya-driver-ride-location';

/**
 * The session is read through the shared store (packages/ui createSessionStore owns the key and
 * the shape, DRV-17). The task can run in a fresh JS context (app relaunched in the background),
 * where the store has not been restored yet. Imported lazily: lib/session imports this file.
 */
async function sessionToken(): Promise<string | null> {
  const { useSession } = await import('./session');
  if (useSession.getState().status === 'loading') await useSession.getState().restore();
  const s = useSession.getState();
  return s.status === 'signedIn' ? s.token : null;
}

if (!STANDALONE_DEMO && Platform.OS !== 'web' && !TaskManager.isTaskDefined(RIDE_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RIDE_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const last = data.locations[data.locations.length - 1]!;
    try {
      const token = await sessionToken();
      // Signed out: the position is no longer shared with anyone.
      if (!token) return stopRideTracking();
      const api = createApiClient({ baseUrl: resolveApiBase(), getToken: () => token });
      const res = await api.driver.sendLocation({ lat: last.coords.latitude, lng: last.coords.longitude });
      // The ride ended while the phone was locked.
      if (res.onRide === false) return stopRideTracking();
    } catch (e) {
      // Refused (offline without a ride, session expired). Network loss is surfaced to the
      // passenger as stale tracking; nothing to do here.
      if (isApiError(e) && (e.status === 401 || e.status === 403 || e.status === 409)) return stopRideTracking();
    }
  });
}

export type BackgroundResult = 'started' | 'unsupported' | 'denied' | 'foreground-only' | 'needs-consent';

const supported = () => !STANDALONE_DEMO && Platform.OS !== 'web';

/** Starts lock-screen sharing when « Always » is already granted. Never shows a system prompt. */
export async function startRideTracking(): Promise<BackgroundResult> {
  if (!supported()) return 'unsupported';
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) return 'denied';
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted) return bg.canAskAgain ? 'needs-consent' : 'foreground-only';
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK)) return 'started';
    await Location.startLocationUpdatesAsync(RIDE_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 15,
      timeInterval: 5000,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      // killServiceOnDestroy: a killed app must not leave the service sharing the position on its own.
      foregroundService: { notificationTitle: 'Course Naya en cours', notificationBody: 'Votre position est partagée avec la passagère jusqu’à la fin de la course.', notificationColor: '#6B3657', killServiceOnDestroy: true },
    });
    return 'started';
  } catch {
    return 'foreground-only';
  }
}

/** True when the explainer should be offered: foreground granted, « Always » not granted and still askable. */
export async function needsBackgroundConsent(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) return false;
    const bg = await Location.getBackgroundPermissionsAsync();
    return !bg.granted && bg.canAskAgain;
  } catch {
    return false;
  }
}

/** Shows the system « Always » prompt (Android: the settings page), then starts sharing if granted. Call only after the explainer. */
export async function requestRideBackgroundLocation(): Promise<BackgroundResult> {
  if (!supported()) return 'unsupported';
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return 'foreground-only';
  } catch {
    return 'foreground-only';
  }
  return startRideTracking();
}

export async function stopRideTracking() {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(RIDE_LOCATION_TASK);
  } catch {
    // Already stopped.
  }
}
