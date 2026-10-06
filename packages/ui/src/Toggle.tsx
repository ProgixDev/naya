import { useTheme } from './core/theme';
import { Switch, type SwitchProps } from 'react-native';
import { colors } from '@naya/tokens';

/** Branded switch: plum track when on, pearl line when off, white thumb on every platform. */
export function Toggle(props: Omit<SwitchProps, 'trackColor' | 'thumbColor'>) {
  useTheme();
  return (
    <Switch
      trackColor={{ true: colors.accent, false: colors.line }}
      thumbColor={colors.surface}
      ios_backgroundColor={colors.line}
      {...({ activeThumbColor: colors.surface } as object)}
      {...props}
    />
  );
}
