import { useTheme } from './core/theme';
import { Switch, type SwitchProps } from 'react-native';
import { colors } from '@naya/tokens';

/**
 * Branded switch: plum track when on, outline track when off, light thumb on every platform and in
 * both schemes. The off-track uses `outline` (≥ 3:1 against surface, WCAG 1.4.11): `line` was
 * 1.28:1 in light and 1.45:1 in dark, so the off state vanished into the row.
 */
export function Toggle(props: Omit<SwitchProps, 'trackColor' | 'thumbColor'>) {
  useTheme();
  return (
    <Switch
      trackColor={{ true: colors.accent, false: colors.outline }}
      thumbColor={colors.thumb}
      ios_backgroundColor={colors.outline}
      {...({ activeThumbColor: colors.thumb } as object)}
      {...props}
    />
  );
}
