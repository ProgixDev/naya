import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@naya/api';
import type { SessionStore } from './session';

/** Clears every account-scoped cache when the signed-in account changes or signs out. */
export function AccountBoundary({ session, children }: { session: SessionStore; children: ReactNode }) {
  const qc = useQueryClient();
  const accountId = session((s) => s.accountId);
  const [prev, setPrev] = useState(accountId);
  useEffect(() => {
    if (prev !== accountId) {
      // Remove only the previous account. Removing the whole root here would race
      // and detach queries already mounted for the new account.
      if (prev !== null) qc.removeQueries({ queryKey: qk.account(prev) });
      setPrev(accountId);
    }
  }, [accountId, prev, qc]);
  return <>{children}</>;
}
