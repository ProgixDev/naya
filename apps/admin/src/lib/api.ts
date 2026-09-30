import { QueryClient } from '@tanstack/react-query';
import { createApiClient, shouldRetry } from '@naya/api';
import type { AdminUser } from '@naya/domain';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4010';
const KEY = 'naya.admin.session';

export interface AdminSession {
  token: string;
  admin: AdminUser;
}

/** Admin credentials are separate from the mobile apps and live only for the browser tab. */
export const sessionStore = {
  get(): AdminSession | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AdminSession) : null;
    } catch {
      return null;
    }
  },
  set(s: AdminSession) {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  },
  clear() {
    sessionStorage.removeItem(KEY);
  },
};

type Listener = () => void;
const expiredListeners = new Set<Listener>();
export const onSessionExpired = (l: Listener) => {
  expiredListeners.add(l);
  return () => {
    expiredListeners.delete(l);
  };
};

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => sessionStore.get()?.token ?? null,
  onUnauthorized: () => {
    if (!sessionStore.get()) return;
    sessionStore.clear();
    expiredListeners.forEach((l) => l());
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, staleTime: 10_000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});

/** Private documents are fetched with the admin bearer token and shown through a blob URL. */
export async function fetchUploadBlob(id: string): Promise<{ url: string; type: string }> {
  const res = await fetch(`${API_URL}/uploads/${id}`, { headers: { Authorization: `Bearer ${sessionStore.get()?.token ?? ''}` } });
  if (!res.ok) throw new Error(res.status === 403 ? 'Accès au document refusé.' : 'Document indisponible.');
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}
