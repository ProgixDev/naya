import { useSyncExternalStore } from 'react';
import { AppState, Appearance, Platform, type NativeEventSubscription } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getColorScheme, subscribeColors, setColorScheme } from '@naya/tokens';

/**
 * Runtime light/dark theme (ADR-0023, UI-09).
 *
 * The palette lives in @naya/tokens (`colors` Proxy + `themedStyles`). This module decides
 * which palette is current and keeps it in sync:
 * - At import, before any component renders, the palette is seeded from the device
 *   appearance, so a cold start in dark never paints a light first frame.
 * - The stored choice (AsyncStorage 'naya.theme') is read at import too. `useThemeReady()`
 *   turns true once it is known; the root layout keeps the splash up until then.
 * - In 'system' mode the scheme comes from Appearance change events. On iOS the value read
 *   right after clearing an override is stale (RCTAppearance updates it only when the trait
 *   change notification arrives), so it is never used.
 * - Changes that arrive while the app is in the background are deferred: iOS flips the trait
 *   to light and dark while it takes app-switcher snapshots.
 *
 * Every component that reads `colors.*` must call `useTheme()` (enforced by
 * packages/ui/src/__tests__/theme.test.tsx).
 */
export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'naya.theme';
const isMode = (v: unknown): v is ThemeMode => v === 'light' || v === 'dark' || v === 'system';

let mode: ThemeMode = 'system';
let loaded = false;
let chosenBeforeLoad = false;
/** True once this process has forced a native override; the system value is then only trusted from change events. */
let overridden = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const toScheme = (value: string | null | undefined): 'light' | 'dark' => (value === 'dark' ? 'dark' : 'light');

const apply = () => {
  if (mode !== 'system') {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(mode);
      overridden = true;
    }
    setColorScheme(mode);
    return;
  }
  if (Platform.OS !== 'web' && overridden) {
    // Clearing the override: keep the current palette. If the system scheme differs, iOS posts
    // a trait change and the listener below switches; if it is the same, nothing has to change.
    Appearance.setColorScheme('unspecified');
    return;
  }
  setColorScheme(toScheme(Appearance.getColorScheme()));
};

// 1. Seed before the first render. Nothing has forced an override yet, so this read is exact.
setColorScheme(toScheme(Appearance.getColorScheme()));

// 2. Follow the system while in 'system' mode. Fast Refresh re-runs this module: drop the
//    previous copy's subscriptions so only one set of listeners drives the palette.
type ThemeGlobal = { __nayaThemeSubs?: { remove(): void }[] };
const g = globalThis as ThemeGlobal;
g.__nayaThemeSubs?.forEach((s) => s.remove());
const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => {
  if (mode !== 'system' || AppState.currentState === 'background') return;
  setColorScheme(toScheme(colorScheme));
});
const appStateSub: NativeEventSubscription = AppState.addEventListener('change', (state) => {
  // Appearance keeps the last value it reported, including changes deferred while in background.
  if (state === 'active' && mode === 'system') setColorScheme(toScheme(Appearance.getColorScheme()));
});
g.__nayaThemeSubs = [appearanceSub, appStateSub];

// 3. The stored choice, read once at import.
export const themeLoaded: Promise<void> = AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (!chosenBeforeLoad && isMode(saved) && saved !== mode) {
      mode = saved;
      apply();
    }
  })
  .catch(() => undefined)
  .then(() => {
    loaded = true;
    notify();
  });

export const subscribeThemeMode = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getThemeMode = () => mode;
const getLoaded = () => loaded;

/** Subscribes the calling component to the palette: it re-renders when light/dark changes. */
export function useTheme() {
  return useSyncExternalStore(subscribeColors, getColorScheme, getColorScheme);
}

/** True once the stored appearance choice is applied. Hold the splash until then. */
export function useThemeReady() {
  return useSyncExternalStore(subscribeThemeMode, getLoaded, getLoaded);
}

export async function setThemeMode(next: ThemeMode) {
  if (!loaded) chosenBeforeLoad = true;
  mode = next;
  apply();
  notify();
  await AsyncStorage.setItem(STORAGE_KEY, next);
}

/**
 * Kept for AppProviders. The theme now syncs at import (see above), so this renders nothing;
 * it no longer re-applies the scheme from `useColorScheme()`, which re-read the stale value.
 */
export function ThemeController() {
  return null;
}
