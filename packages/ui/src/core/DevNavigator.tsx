import { useEffect, useRef } from 'react';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { qk } from '@naya/api';
import type { SessionStore } from './session';

/**
 * Review builds only (EXPO_PUBLIC_REVIEW=1): polls the demo API for a navigation command so
 * screenshots of native builds can be captured route by route without tapping. Never
 * rendered in production builds.
 */
export function DevNavigator({ app, session }: { app: 'passenger' | 'driver'; session: SessionStore }) {
  const api = useApi();
  const qc = useQueryClient();
  const last = useRef(0);
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_REVIEW !== '1') return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`${api.baseUrl}/dev/navigate?app=${app}`);
        const cmd = (await res.json()) as { id: number; route: string; phone: string | null } | null;
        if (!cmd || cmd.id === last.current) return;
        last.current = cmd.id;
        if (cmd.phone) {
          const current = session.getState();
          await api.auth.requestOtp(cmd.phone, app).catch(() => undefined);
          const r = await api.auth.verifyOtp(cmd.phone, app, '123456');
          if (current.accountId !== r.user.id) qc.removeQueries({ queryKey: qk.root });
          await session.getState().signIn(r.token, r.user.id);
          await new Promise((ok) => setTimeout(ok, 1200));
        } else if (cmd.route === '__signout') {
          await session.getState().signOut();
          return;
        }
        await qc.invalidateQueries({ queryKey: qk.root });
        router.replace(cmd.route as Href);
      } catch {
        // The review hook is best-effort and silent.
      }
    }, 1000);
    return () => clearInterval(t);
  }, [api, app, qc, session]);
  return null;
}
