import { useEffect, useSyncExternalStore } from 'react';
import { Appearance, useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getColorScheme, subscribeColors, setColorScheme } from '@naya/tokens';
export type ThemeMode = 'light' | 'dark' | 'system';
let mode: ThemeMode = 'system';
const listeners = new Set<() => void>();
export const subscribeThemeMode = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getThemeMode = () => mode;
const apply = () => {
  if (Platform.OS !== 'web')
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  setColorScheme(
    mode === 'system'
      ? Appearance.getColorScheme() === 'dark'
        ? 'dark'
        : 'light'
      : mode,
  );
};
export function useTheme() {
  return useSyncExternalStore(subscribeColors, getColorScheme, getColorScheme);
}
export async function setThemeMode(next: ThemeMode) {
  mode = next;
  apply();
  listeners.forEach((fn) => fn());
  await AsyncStorage.setItem('naya.theme', next);
}
export function ThemeController() {
  const system = useColorScheme();
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('naya.theme').then((saved) => {
      if (
        active &&
        (saved === 'light' || saved === 'dark' || saved === 'system')
      ) {
        mode = saved;
        apply();
        listeners.forEach((fn) => fn());
      }
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(apply, [system]);
  return null;
}
