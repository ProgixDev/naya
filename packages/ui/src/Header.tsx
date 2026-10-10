import { useTheme } from './core/theme';
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft, X } from 'lucide-react-native';
import { colors, gutter } from '@naya/tokens';
import { IconButton } from './Button';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { haptic } from './haptics';
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

/** Back / action button of screen headers: the bare icon on a 44 pt touch area. */
export const headerButtonStyle = () =>
  ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }) as const;

/**
 * iOS-style navigation bar: plum chevron on the left, title centred (24 pt semibold),
 * optional action on the right. Sides are equal width so the title stays centred.
 */
export function AppBar({ title, onBack, right, subtitle, progress, overlay }: { title: string; onBack: () => void; right?: ReactNode; subtitle?: string; progress?: { step: number; total: number }; overlay?: boolean }) {
  useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 2, paddingBottom: 16, position: overlay ? 'absolute' : 'relative', left: 0, right: 0, zIndex: 10 }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
        <View style={{ width: 72, alignItems: 'flex-start' }}>
          <PressableScale
            onPress={() => { haptic.select(); onBack(); }}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            testID="header-back"
            hitSlop={8}
            pressedScale={0.92}
            style={headerButtonStyle()}
          >
            <ChevronLeft size={28} color={colors.accent} strokeWidth={2.4} />
          </PressableScale>
        </View>
        <Text weight="semibold" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} align="center" style={{ flex: 1, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 }}>
          {title}
        </Text>
        <View style={{ width: 72, alignItems: 'flex-end' }}>{right}</View>
      </View>
      {progress ? (
        <View style={{ marginTop: 8, paddingHorizontal: gutter }}>
          <StepProgress step={progress.step} total={progress.total} />
        </View>
      ) : null}
      {subtitle ? <Text variant="label" tone="muted" style={{ marginTop: 8, paddingHorizontal: gutter }}>{subtitle}</Text> : null}
    </View>
  );
}

export function Header({ title, large = true, subtitle, onBack, onClose, right, overlay, progress }: HeaderProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  if (large && title && onBack && !onClose) return <AppBar title={title} onBack={onBack} right={right} subtitle={subtitle} progress={progress} overlay={overlay} />;
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
