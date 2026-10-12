import { themedStyles, colors, control, shadow } from '@naya/tokens';
import { useTheme } from './core/theme';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { Glass } from './Glass';
import { FrostLayers, GlossLayers, frostOutline, frostShadow, glossShadow } from './Material';
import { hitSlopFor } from './a11y';
import { haptic } from './haptics';

type Size = 'major' | 'standard' | 'compact';
type Variant = 'primary' | 'secondary' | 'tonal' | 'danger' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Shown to assistive tech and under the label while loading ("Envoi…"). */
  loadingLabel?: string;
  disabled?: boolean;
  /** Short reason shown under a disabled primary action. */
  disabledReason?: string;
  icon?: ReactNode;
  full?: boolean;
  pill?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

const heights: Record<Size, number> = { major: control.major, standard: control.standard, compact: control.compact };

/**
 * One component for every button (rounded pill styling). Primary = solid plum with a soft shadow;
 * secondary/tonal = frosted glass; ghost = text. Loading keeps the width (label stays in
 * layout, hidden); disabled is a neutral grey, never a paler plum.
 */
export function Button({ label, onPress, variant = 'primary', size = 'standard', loading, loadingLabel, disabled, disabledReason, icon, full, pill, style, accessibilityHint, testID }: ButtonProps) {
  useTheme();
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const h = heights[size];
  // Smooth pill geometry for major actions or when pill is requested.
  const r = pill || size === 'major' ? Math.round(h / 2) : size === 'compact' ? 14 : 18;

  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';
  const isTonal = variant === 'tonal';

  const backgroundColor = disabled
    ? colors.disabledFill
    : isPrimary
    ? colors.accent
    : isDanger
    ? colors.danger
    : isSecondary
    ? colors.surface
    : isTonal
    ? colors.selected
    : 'transparent';

  const borderWidth = isSecondary ? 1 : 0;
  const borderColor = isSecondary ? colors.line : 'transparent';

  const textTone = disabled
    ? 'disabled'
    : isPrimary || isDanger
    ? 'inverse'
    : 'accent';

  return (
    <View collapsable={false} style={[full ? { alignSelf: 'stretch' } : { alignItems: 'flex-start' }, style]}>
      <PressableScale
        testID={testID}
        onPress={() => {
          if (inactive) return;
          haptic.tap();
          onPress?.();
        }}
        disabled={inactive}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        hitSlop={hitSlopFor(h)}
        accessibilityRole="button"
        accessibilityLabel={loading && loadingLabel ? loadingLabel : label}
        accessibilityHint={disabled && disabledReason ? disabledReason : accessibilityHint}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        style={[
          styles.pill,
          {
            minHeight: h,
            borderRadius: r,
            backgroundColor,
            borderWidth,
            borderColor,
          },
          isPrimary && !disabled ? shadow.button : null,
          focused ? styles.focus : null,
        ]}
      >
        <View collapsable={false} style={[styles.row, { minHeight: h, paddingVertical: 10, paddingHorizontal: size === 'compact' ? 16 : 22 }]}>
          {loading ? (
            <ActivityIndicator
              color={isPrimary || isDanger ? colors.inverse : colors.accent}
            />
          ) : (
            <View collapsable={false} style={[styles.row, { gap: 8, flexShrink: 1 }]}>
              {icon}
              <Text
                variant="action"
                weight={isPrimary || isDanger ? 'bold' : 'semibold'}
                tone={textTone}
                maxFontSizeMultiplier={1.4}
                align="center"
                style={[{ flexShrink: 1 }, size === 'major' ? { fontSize: 17, lineHeight: 22 } : undefined]}
              >
                {label}
              </Text>
            </View>
          )}
        </View>
      </PressableScale>
      {disabled && disabledReason ? (
        <Text variant="caption" tone="muted" align="center" style={{ marginTop: 8 }}>
          {disabledReason}
        </Text>
      ) : null}
      {loading && loadingLabel ? (
        <Text variant="caption" tone="muted" align="center" style={{ marginTop: 8 }} accessibilityLiveRegion="polite">
          {loadingLabel}
        </Text>
      ) : null}
    </View>
  );
}

export interface GlassButtonProps {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

/** Frosted pill for floating secondary actions over the map. */
export function GlassButton({ label, onPress, icon, selected, style, testID, accessibilityHint }: GlassButtonProps) {
  useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ selected: !!selected }} hitSlop={hitSlopFor(40)} style={style}>
      <Glass radius={999} contentStyle={{ height: 44, paddingHorizontal: 16, gap: 8 }}>
        {icon}
        <Text variant="label" tone={selected ? 'accent' : 'ink'} numberOfLines={1} weight={selected ? 'semibold' : 'medium'}>
          {label}
        </Text>
      </Glass>
    </PressableScale>
  );
}

export interface IconButtonProps {
  icon: ReactNode;
  /** Required: every icon-only control is named for screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  /** Visible text label under unfamiliar icons. */
  label?: string;
  variant?: 'glass' | 'solid' | 'plain' | 'tonal';
  size?: number;
  disabled?: boolean;
  testID?: string;
}

export function IconButton({ icon, accessibilityLabel, onPress, label, variant = 'glass', size = 44, disabled, testID }: IconButtonProps) {
  useTheme();
  const disc =
    variant === 'glass' ? (
      <Glass radius={size / 2} contentStyle={{ width: size, height: size }}>
        {icon}
      </Glass>
    ) : (
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }, variant === 'solid' ? [frostShadow, frostOutline] : null]}>
        {variant === 'solid' || variant === 'tonal' ? <FrostLayers radius={size / 2} tint={variant === 'tonal' ? 'mauve' : 'white'} /> : null}
        {/* Wrapped so the icon paints above the absolutely positioned frost layers (web stacking). */}
        <View style={styles.disc}>{icon}</View>
      </View>
    );
  return (
    <PressableScale testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={hitSlopFor(size)} style={{ alignItems: 'center', opacity: disabled ? 0.45 : 1 }}>
      {disc}
      {label ? (
        <Text variant="micro" tone="ink" style={{ marginTop: 6 }} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </PressableScale>
  );
}

export function TextButton({ label, onPress, tone = 'accent', testID }: { label: string; onPress?: () => void; tone?: 'accent' | 'danger' | 'muted'; testID?: string }) {
  useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} accessibilityRole="button" hitSlop={hitSlopFor(24)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 8 }} pressedScale={0.98}>
      <Text variant="action" tone={tone} align="center">
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  pill: { justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  focus: { borderWidth: 2, borderColor: colors.info },
}));
