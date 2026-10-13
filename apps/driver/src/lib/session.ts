import { createSessionStore } from '@naya/ui';
import { stopRideTracking } from './backgroundLocation';

export const useSession = createSessionStore('driver');

// Lock-screen location sharing belongs to a signed-in driver: every sign-out path (account,
// dossier, dev launcher, expired session) and a launch without a session stop it.
useSession.subscribe((s, prev) => {
  if (s.status === 'signedOut' && prev.status !== 'signedOut') void stopRideTracking();
});
