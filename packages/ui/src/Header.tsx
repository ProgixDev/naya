import { useTheme } from './core/theme';
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';
import { colors, gutter } from '@naya/tokens';
import { IconButton } from './Button';
import { Text } from './Text';
import { StepProgress } from './Progress';

export interface HeaderProps {
  title?: string;
  /** Large left title (28–30) under the controls, or a compact centred one. */
  large?: boolean;
  subtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  right?: ReactNode;
  /** Header floats over a map. */
  overlay?: boolean;
  /** Segmented step indicator shown above the title. */
  progress?: { step: number; total: number };
}

export function Header({ title, large = true, subtitle, onBack, onClose, right, overlay, progress }: HeaderProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  const hasBar = onBack || onClose || right || (!large && title);
  return (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: gutter, paddingBottom: large && title ? 18 : 8, position: overlay ? 'absolute' : 'relative', left: 0, right: 0, zIndex: 10 }}>
      {hasBar ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12 }}>
          {onBack ? <IconButton icon={<ArrowLeft size={22} color={colors.ink} />} accessibilityLabel="Retour" onPress={onBack} testID="header-back" /> : null}
          {!large && title ? (
            <Text variant="action" weight="semibold" align="center" style={{ flex: 1 }} accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {right}
          {onClose ? <IconButton icon={<X size={22} color={colors.ink} />} accessibilityLabel="Fermer" onPress={onClose} variant="tonal" testID="header-close" /> : null}
        </View>
      ) : null}
      {progress ? (
        <View style={{ marginTop: hasBar ? 4 : 8, marginBottom: 2 }}>
          <StepProgress step={progress.step} total={progress.total} />
        </View>
      ) : null}
      {large && title ? (
        <View style={{ marginTop: hasBar ? 14 : 12, gap: 6 }}>
          <Text variant="screen" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text variant="label" tone="muted">{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
