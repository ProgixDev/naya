import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Non-sensitive device preferences only. Versioned for safe evolution. */
interface Prefs {
  onboardingDone: boolean;
  /** Demo-only: continue online with the demo position when GPS is refused. */
  demoPositionAccepted: boolean;
  setOnboardingDone: () => void;
  setDemoPositionAccepted: (v: boolean) => void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      onboardingDone: false,
      demoPositionAccepted: false,
      setOnboardingDone: () => set({ onboardingDone: true }),
      setDemoPositionAccepted: (demoPositionAccepted) => set({ demoPositionAccepted }),
    }),
    { name: 'naya.driver.prefs', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);
