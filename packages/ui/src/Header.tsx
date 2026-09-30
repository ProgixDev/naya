import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';
import { colors, gutter } from '@naya/tokens';
import { IconButton } from './Button';
import { Text } from './Text';

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
}

export function Header({ title, large = true, subtitle, onBack, onClose, right, overlay }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const hasBar = onBack || onClose || right || (!large && title);
  return (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: gutter, paddingBottom: large && title ? 4 : 8, position: overlay ? 'absolute' : 'relative', left: 0, right: 0, zIndex: 10 }}>
      {hasBar ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 }}>
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
      {large && title ? (
        <View style={{ marginTop: hasBar ? 10 : 8, gap: 6 }}>
          <Text variant="hero" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text variant="label" tone="muted">{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
