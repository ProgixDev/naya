import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, control } from '@naya/tokens';
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
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

const heights: Record<Size, number> = { major: control.major, standard: control.standard, compact: control.compact };

/**
 * One component for every pill button. Primary = glossy plum (the one action per screen);
 * secondary/tonal = frosted glass; ghost = text. Loading keeps the width (label stays in
 * layout, hidden); disabled is a neutral grey, never a paler plum.
 */
export function Button({ label, onPress, variant = 'primary', size = 'standard', loading, loadingLabel, disabled, disabledReason, icon, full, style, accessibilityHint, testID }: ButtonProps) {
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const h = heights[size];
  const r = h / 2;
  const gloss = !disabled && (variant === 'primary' || variant === 'danger');
  const frost = !disabled && (variant === 'secondary' || variant === 'tonal');
  const textTone = disabled ? 'disabled' : gloss ? 'inverse' : variant === 'ghost' ? 'accent' : 'accent';
  const content = (
    <View style={[styles.row, { height: h, paddingHorizontal: size === 'compact' ? 16 : 22 }]}>
      <View style={[styles.row, { opacity: loading ? 0 : 1, gap: 8 }]}>
        {icon}
        <Text variant="action" tone={textTone} numberOfLines={1} maxFontSizeMultiplier={1.4} style={size === 'major' ? { fontSize: 16 } : undefined}>
          {label}
        </Text>
      </View>
      {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} color={gloss ? colors.inverse : colors.accent} /> : null}
    </View>
  );
  return (
    <View style={[full ? { alignSelf: 'stretch' } : { alignItems: 'flex-start' }, style]}>
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
          { minHeight: h, borderRadius: r },
          disabled ? { backgroundColor: colors.disabledFill } : null,
          gloss ? glossShadow(variant === 'danger' ? 'danger' : 'accent') : null,
          frost ? frostShadow : null,
          frost && variant === 'secondary' ? frostOutline : null,
          focused ? styles.focus : null,
        ]}
      >
        {gloss ? <GlossLayers tone={variant === 'danger' ? 'danger' : 'accent'} radius={r} /> : null}
        {frost ? <FrostLayers radius={r} tint={variant === 'tonal' ? 'mauve' : 'white'} /> : null}
        {content}
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
  const disc =
    variant === 'glass' ? (
      <Glass radius={size / 2} contentStyle={{ width: size, height: size }}>
        {icon}
      </Glass>
    ) : (
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }, variant === 'solid' ? [frostShadow, frostOutline] : null]}>
        {variant === 'solid' || variant === 'tonal' ? <FrostLayers radius={size / 2} tint={variant === 'tonal' ? 'mauve' : 'white'} /> : null}
        {icon}
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
  return (
    <PressableScale testID={testID} onPress={onPress} accessibilityRole="button" hitSlop={hitSlopFor(24)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 8 }} pressedScale={0.98}>
      <Text variant="action" tone={tone} align="center">
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, overflow: Platform.OS === 'android' ? 'hidden' : 'visible', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  focus: { borderWidth: 2, borderColor: colors.info },
});
