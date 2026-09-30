import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { serverClock, type ApiClient } from './client';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return createElement(ApiContext.Provider, { value: client }, children);
}

export function useApi(): ApiClient {
  const c = useContext(ApiContext);
  if (!c) throw new Error('useApi must be used inside <ApiProvider>');
  return c;
}

/**
 * Seconds remaining until an authoritative deadline, computed from the server clock.
 * It never resets on re-render, navigation or backgrounding: it always derives from
 * `expiresAt`, so returning to the screen shows the true remaining time.
 */
export function useDeadline(expiresAt: string | null | undefined, intervalMs = 250) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [expiresAt, intervalMs]);
  // Derived on every render from the deadline, so a new deadline is never briefly "expired".
  const remainingMs = expiresAt ? Math.max(0, Date.parse(expiresAt) - serverClock.now()) : 0;
  return { remainingMs, seconds: Math.ceil(remainingMs / 1000), expired: !!expiresAt && remainingMs <= 0 };
}
