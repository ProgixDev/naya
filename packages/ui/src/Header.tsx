import { useTheme } from './core/theme';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';
import { colors, gutter } from '@naya/tokens';
import { IconButton } from './Button';
import { Text } from './Text';
import { StepProgress } from './Progress';
import { useA11yPrefs } from './a11y';

export interface HeaderProps {
  title?: string;
  /** Large left title (30) under the controls, or a compact centred one. Inside `Screen`, a large title collapses on scroll. */
  large?: boolean;
  subtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  right?: ReactNode;
  /** Header floats over a map. */
  overlay?: boolean;
  /** Segmented step indicator shown above the title. */
  progress?: { step: number; total: number };
  /** Set by `Screen`: the large title is rendered in the scroll content and this header is the floating bar. */
  titleInContent?: boolean;
  /** Set by `Screen`: the large title has scrolled under the bar, so the compact title and the backdrop show. */
  collapsed?: boolean;
  /** Set by `Screen`: the backdrop colour behind the collapsed bar (the screen's background). */
  backdrop?: string;
  /** Set by `Screen`: measures the floating bar so the content starts below it. */
  onBarLayout?: (e: LayoutChangeEvent) => void;
}

const BAR = 44;

/** First-frame estimate of the floating bar's height, before it is measured. */
export function headerBarEstimate(insetTop: number, p: Pick<HeaderProps, 'onBack' | 'onClose' | 'right' | 'progress'>) {
  const hasBar = !!(p.onBack || p.onClose || p.right);
  return insetTop + 6 + (hasBar ? BAR : 0) + (p.progress ? (hasBar ? 4 : 8) + 6 : 0);
}

/** The large title block that `Screen` renders at the top of its scroll content (30/600, subtitle 15). */
export function HeaderLargeTitle({ title, subtitle, hasBar, onLayout }: { title: string; subtitle?: string; hasBar: boolean; onLayout?: (e: LayoutChangeEvent) => void }) {
  useTheme();
  return (
    <View testID="header-large-title" onLayout={onLayout} style={{ paddingTop: hasBar ? 14 : 12, paddingBottom: 18, gap: 6 }}>
      <Text variant="screen" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text variant="label" tone="muted">{subtitle}</Text> : null}
    </View>
  );
}

function CompactTitle({ title, hidden }: { title: string; hidden?: boolean }) {
  return (
    <Text
      variant="action"
      weight="semibold"
      align="center"
      style={{ flex: 1, fontSize: 17, lineHeight: 22 }}
      accessibilityRole={hidden ? undefined : 'header'}
      // When the large title is still on the page, the compact one is a visual echo only.
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : undefined}
      aria-hidden={hidden || undefined}
      numberOfLines={1}
    >
      {title}
    </Text>
  );
}

export function Header({ title, large = true, subtitle, onBack, onClose, right, overlay, progress, titleInContent, collapsed, backdrop, onBarLayout }: HeaderProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11yPrefs();
  const fade = useSharedValue(collapsed ? 1 : 0);
  useEffect(() => {
    const to = collapsed ? 1 : 0;
    fade.value = reduceMotion ? to : withTiming(to, { duration: 160 });
  }, [collapsed, reduceMotion, fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const back = onBack ? <IconButton icon={<ArrowLeft size={24} color={colors.ink} />} accessibilityLabel="Retour" onPress={onBack} testID="header-back" /> : null;
  const close = onClose ? <IconButton icon={<X size={24} color={colors.ink} />} accessibilityLabel="Fermer" onPress={onClose} variant="tonal" testID="header-close" /> : null;

  if (titleInContent && title) {
    // Floating bar over the scroll content (Screen renders the large title below it).
    const hasControls = !!(onBack || onClose || right);
    return (
      <View pointerEvents="box-none" onLayout={onBarLayout} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: insets.top + 6, paddingHorizontal: gutter }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: backdrop ?? colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, fadeStyle]} />
        {hasControls || collapsed ? (
          <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', minHeight: BAR, gap: 12, paddingBottom: collapsed && !hasControls ? 6 : 0 }}>
            {back}
            {collapsed ? (
              <Animated.View style={[{ flex: 1 }, fadeStyle]}>
                <CompactTitle title={title} hidden />
              </Animated.View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {right}
            {close}
          </View>
        ) : null}
        {progress ? (
          <View style={{ marginTop: hasControls ? 4 : 8, marginBottom: 2 }}>
            <StepProgress step={progress.step} total={progress.total} />
          </View>
        ) : null}
      </View>
    );
  }

  const hasBar = onBack || onClose || right || (!large && title);
  return (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: gutter, paddingBottom: large && title ? 18 : 8, position: overlay ? 'absolute' : 'relative', left: 0, right: 0, zIndex: 10 }}>
      {hasBar ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: BAR, gap: 12 }}>
          {back}
          {!large && title ? <CompactTitle title={title} /> : <View style={{ flex: 1 }} />}
          {right}
          {close}
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
