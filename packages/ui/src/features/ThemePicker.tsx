import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { SegmentedControl } from '../SegmentedControl';
import { Text } from '../Text';
import { useTheme, setThemeMode, subscribeThemeMode, getThemeMode, type ThemeMode } from '../core/theme';

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

/**
 * Appearance as one 3-segment control (P-37), in both apps. Each segment is `theme-<mode>`.
 * `footnote` sits under it, as a list group's footnote does.
 */
export function ThemePicker({ footnote }: { footnote?: string } = {}) {
  const selected = useSyncExternalStore(subscribeThemeMode, getThemeMode, getThemeMode);
  useTheme();
  return (
    <View>
      <Text variant="caption" tone="muted" weight="semibold" style={{ marginBottom: 8, marginLeft: 4 }} accessibilityRole="header">
        Apparence
      </Text>
      <SegmentedControl
        options={OPTIONS}
        value={selected}
        onChange={(mode) => {
          setThemeMode(mode).catch(() => undefined);
        }}
        testID="theme"
      />
      {footnote ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 8, marginHorizontal: 4 }}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}
