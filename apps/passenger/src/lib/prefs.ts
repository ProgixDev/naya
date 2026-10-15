import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useAccountId, useMe } from './queries';

/** City shown before the account has loaded, on a phone that has never cached one. */
export const DEFAULT_CITY_ID = 'rabat';

/** Non-sensitive device preferences only. Versioned so the shape can evolve safely. */
interface Prefs {
  onboardingDone: boolean;
  /**
   * Cache of the server's `user.cityId` (ADR-0054, PAX-05), never the source of truth. Written only from `/me`
   * by `useCityId`; read it through `useCityId()` so a stale value from another account is never used.
   */
  cityId: string;
  /** Account whose city is cached, so a new account on the same phone does not inherit it. */
  cityAccountId: string | null;
  setOnboardingDone: () => void;
  cacheCity: (accountId: string, cityId: string) => void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      onboardingDone: false,
      cityId: DEFAULT_CITY_ID,
      cityAccountId: null,
      setOnboardingDone: () => set({ onboardingDone: true }),
      cacheCity: (cityAccountId, cityId) => set({ cityAccountId, cityId }),
    }),
    {
      name: 'naya.passenger.prefs',
      version: 2,
      // v1 kept a device-chosen city with no owner: keep it as an unowned cache until /me confirms it.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<Prefs>;
        return version < 2 ? { ...p, cityAccountId: null } : p;
      },
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * The passenger's city: the server's `user.cityId` from `/me`. While `/me` loads, the cached value for this
 * account, else the default. Each render that has the server value refreshes the cache.
 */
export function useCityId(): string {
  const me = useMe();
  const accountId = useAccountId();
  const serverCity = me.data?.user.cityId;
  const cached = usePrefs((s) => (s.cityAccountId === accountId ? s.cityId : null));
  const cacheCity = usePrefs((s) => s.cacheCity);
  useEffect(() => {
    if (serverCity && serverCity !== cached) cacheCity(accountId, serverCity);
  }, [accountId, serverCity, cached, cacheCity]);
  return serverCity ?? cached ?? DEFAULT_CITY_ID;
}
