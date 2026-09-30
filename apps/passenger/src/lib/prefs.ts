import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Non-sensitive device preferences only. Versioned so the shape can evolve safely. */
interface Prefs {
  onboardingDone: boolean;
  cityId: string;
  setOnboardingDone: () => void;
  setCity: (id: string) => void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      onboardingDone: false,
      cityId: 'rabat',
      setOnboardingDone: () => set({ onboardingDone: true }),
      setCity: (cityId) => set({ cityId }),
    }),
    { name: 'naya.passenger.prefs', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);
