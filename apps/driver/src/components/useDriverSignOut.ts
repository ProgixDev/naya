import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { useSession } from '@/lib/session';

/**
 * Sign-out for a chauffeuse (DRV-10). She leaves the dispatch pool first, so no offer reaches a
 * signed-out phone. When the server refuses (ACTIVE_RIDE_EXISTS during an accepted ride, or no
 * network, which means the server still sees her online), she stays signed in and `run` resolves to
 * the server's reason for the caller to show. An expired session signs out anyway.
 */
export function useDriverSignOut() {
  const api = useApi();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const run = async (): Promise<string | null> => {
    setPending(true);
    const refusal = await api.driver.setOnline(false, null).then(
      () => null,
      (e: unknown) => (isApiError(e) && (e.code === 'UNAUTHORIZED' || e.status === 401) ? null : errorMessage(e)),
    );
    if (refusal) {
      setPending(false);
      return refusal;
    }
    await api.auth.logout().catch(() => undefined);
    qc.removeQueries({ queryKey: qk.root });
    await useSession.getState().signOut();
    return null;
  };
  return { run, pending };
}
