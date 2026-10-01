import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

/**
 * Session credentials live in SecureStore (Keychain / Keystore). The Zustand store only
 * mirrors whether a session exists; it is never persisted to ordinary storage.
 * On the web development build, sessionStorage is used because SecureStore is native-only.
 */
const storage = {
  async get(key: string) {
    if (Platform.OS === 'web') return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') return void sessionStorage.setItem(key, value);
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  },
  async del(key: string) {
    if (Platform.OS === 'web') return void sessionStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};

interface SessionState {
  role: 'passenger' | 'driver';
  status: 'loading' | 'signedOut' | 'signedIn';
  token: string | null;
  accountId: string | null;
  restore: () => Promise<void>;
  signIn: (token: string, accountId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function createSessionStore(namespace: 'passenger' | 'driver') {
  const key = `naya.${namespace}.session`;
  return create<SessionState>((set) => ({
    role: namespace,
    status: 'loading',
    token: null,
    accountId: null,
    restore: async () => {
      try {
        const raw = await storage.get(key);
        if (!raw) return set({ status: 'signedOut', token: null, accountId: null });
        const { token, accountId } = JSON.parse(raw) as { token: string; accountId: string };
        set({ status: 'signedIn', token, accountId });
      } catch {
        set({ status: 'signedOut', token: null, accountId: null });
      }
    },
    signIn: async (token, accountId) => {
      await storage.set(key, JSON.stringify({ token, accountId }));
      set({ status: 'signedIn', token, accountId });
    },
    signOut: async () => {
      await storage.del(key);
      set({ status: 'signedOut', token: null, accountId: null });
    },
  }));
}
export type SessionStore = ReturnType<typeof createSessionStore>;
