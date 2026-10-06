import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Pill } from '../Form';
import { Text } from '../Text';
import {
  useTheme,
  setThemeMode,
  subscribeThemeMode,
  getThemeMode,
} from '../core/theme';
export function ThemePicker() {
  const selected = useSyncExternalStore(
    subscribeThemeMode,
    getThemeMode,
    getThemeMode,
  );
  useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text variant="label">Apparence</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(
          [
            { id: 'light', label: 'Clair' },
            { id: 'dark', label: 'Sombre' },
            { id: 'system', label: 'Système' },
          ] as const
        ).map((t) => (
          <Pill
            key={t.id}
            label={t.label}
            selected={selected === t.id}
            onPress={() => {
              setThemeMode(t.id).catch(() => undefined);
            }}
            testID={`theme-${t.id}`}
          />
        ))}
      </View>
    </View>
  );
}
