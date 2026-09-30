import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminPermission, AdminUser } from '@naya/domain';
import { api, onSessionExpired, queryClient, sessionStore } from './api';

interface AuthValue {
  admin: AdminUser | null;
  expired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (p: AdminPermission) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(() => sessionStore.get()?.admin ?? null);
  const [expired, setExpired] = useState(false);

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear();
        setAdmin(null);
        setExpired(true);
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.admin.login(email, password);
    queryClient.clear();
    sessionStore.set({ token: r.token, admin: r.admin });
    setExpired(false);
    setAdmin(r.admin);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* the session is cleared locally either way */
    }
    sessionStore.clear();
    queryClient.clear();
    setAdmin(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({ admin, expired, login, logout, can: (p) => !!admin?.permissions.includes(p) }), [admin, expired, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
