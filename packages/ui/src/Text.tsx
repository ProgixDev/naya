import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, type as scale, type TypeToken } from '@naya/tokens';

export type Tone = 'ink' | 'muted' | 'accent' | 'inverse' | 'success' | 'warning' | 'danger' | 'disabled';

const toneColor: Record<Tone, string> = {
  ink: colors.ink,
  muted: colors.muted,
  accent: colors.accent,
  inverse: colors.inverse,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  disabled: colors.disabledText,
};

export interface NayaTextProps extends TextProps {
  variant?: TypeToken;
  tone?: Tone;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  /** Tabular numerals for money, times and countdowns. */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
}

const weightFont = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' } as const;

/**
 * Inter at an explicit weight. Line height scales with Dynamic Type because it is set in
 * points and RN multiplies both size and line height by the font scale (capped at 1.6).
 */
export function Text({ variant = 'body', tone = 'ink', weight, numeric, align, style, maxFontSizeMultiplier = 1.6, ...rest }: NayaTextProps) {
  const t = scale[variant];
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        {
          fontFamily: weight ? weightFont[weight] : t.font,
          fontSize: t.size,
          lineHeight: t.line,
          letterSpacing: t.tracking,
          color: toneColor[tone],
          textAlign: align,
          fontVariant: numeric ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export const Title = (p: NayaTextProps) => <Text accessibilityRole="header" variant="hero" {...p} />;
export const SectionTitle = (p: NayaTextProps) => <Text accessibilityRole="header" variant="title" {...p} />;
export const Caption = (p: NayaTextProps) => <Text variant="caption" tone="muted" {...p} />;
