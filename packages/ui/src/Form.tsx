import { forwardRef, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { colors, radius } from '@naya/tokens';
import { COUNTRIES, formatNational, type Country } from '@naya/domain';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { hitSlopFor } from './a11y';
import { haptic } from './haptics';

export interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  helper?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  testID?: string;
  inputStyle?: StyleProp<TextStyle>;
}

/** Label above, 52-pt field, helper or error under it. Errors are announced and never only colour. */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField({ label, error, helper, leading, trailing, onFocus, onBlur, editable = true, testID, inputStyle, ...input }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" weight="semibold" tone="ink" nativeID={`${testID ?? label}-label`}>
        {label}
      </Text>
      <View style={[styles.field, focused && styles.focused, !!error && styles.errorBorder, !editable && { backgroundColor: colors.disabledFill }]}>
        {leading}
        <TextInput
          ref={ref}
          testID={testID}
          editable={editable}
          placeholderTextColor={colors.disabledText}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${testID ?? label}-label`}
          accessibilityHint={error ?? helper}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, inputStyle]}
          maxFontSizeMultiplier={1.5}
          {...input}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="muted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

export interface PhoneFieldProps {
  value: string;
  onChangeText: (v: string) => void;
  country: Country;
  onCountryChange: (c: Country) => void;
  error?: string | null;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
}

/** International phone entry, +212 first; digits grouped as the user types. */
export function PhoneField({ value, onChangeText, country, onCountryChange, error, onSubmitEditing, autoFocus }: PhoneFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FormField
        label="Numéro de téléphone"
        testID="phone-input"
        value={formatNational(country, value)}
        onChangeText={(t) => onChangeText(t.replace(/\D/g, ''))}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder={country.example}
        error={error}
        autoFocus={autoFocus}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
        helper="Nous vous envoyons un code à 6 chiffres par SMS."
        leading={
          <PressableScale onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Indicatif ${country.name} ${country.dial}. Changer de pays`} style={styles.country} hitSlop={hitSlopFor(36)}>
            <Text variant="label" weight="semibold" numeric>
              {country.dial}
            </Text>
            <ChevronDown size={16} color={colors.muted} />
          </PressableScale>
        }
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Fermer la liste des pays" />
        <View style={styles.sheet}>
          <Text variant="heading" style={{ marginBottom: 8 }} accessibilityRole="header">
            Indicatif du pays
          </Text>
          {COUNTRIES.map((c) => (
            <PressableScale
              key={c.code}
              onPress={() => {
                haptic.select();
                onCountryChange(c);
                setOpen(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: c.code === country.code }}
              style={styles.countryRow}
              pressedScale={0.99}
            >
              <Text variant="label" style={{ flex: 1 }}>
                {c.name}
              </Text>
              <Text variant="label" tone="muted" numeric>
                {c.dial}
              </Text>
              {c.code === country.code ? <Check size={20} color={colors.accent} /> : <View style={{ width: 20 }} />}
            </PressableScale>
          ))}
        </View>
      </Modal>
    </>
  );
}

export interface OTPFieldProps {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: string | null;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
}

/**
 * Six boxes backed by one hidden input so paste and SMS autofill (iOS oneTimeCode,
 * Android sms-otp) fill every box at once.
 */
export function OTPField({ value, onChange, length = 6, error, onComplete, autoFocus = true }: OTPFieldProps) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  const digits = useMemo(() => Array.from({ length }, (_, i) => value[i] ?? ''), [value, length]);
  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={() => ref.current?.focus()} accessibilityRole="none" style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }} importantForAccessibility="no-hide-descendants">
        {digits.map((d, i) => {
          const active = focused && (i === value.length || (i === length - 1 && value.length === length));
          return (
            <View key={i} style={[styles.box, active && styles.focused, !!error && styles.errorBorder]}>
              <Text variant="title" numeric weight="semibold">
                {d}
              </Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={ref}
        testID="otp-input"
        value={value}
        onChangeText={(t) => {
          const clean = t.replace(/\D/g, '').slice(0, length);
          onChange(clean);
          if (clean.length === length) onComplete?.(clean);
        }}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        accessibilityLabel={`Code de vérification, ${length} chiffres`}
        accessibilityHint={error ?? undefined}
        style={styles.hiddenInput}
        caretHidden
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export interface PillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  testID?: string;
  disabled?: boolean;
}

/** 32-pt chip with a 44-pt touch area; selected = ink fill + check, not just a tint. */
export function Pill({ label, selected, onPress, icon, testID, disabled }: PillProps) {
  return (
    <PressableScale
      testID={testID}
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      hitSlop={hitSlopFor(32)}
      style={[styles.pill, selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : null, disabled ? { opacity: 0.5 } : null]}
    >
      {selected ? <Check size={14} color={colors.inverse} /> : icon}
      <Text variant="caption" weight="semibold" tone={selected ? 'inverse' : 'ink'} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: radius.field, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, gap: 10 },
  focused: { borderColor: colors.accent, borderWidth: 2 },
  errorBorder: { borderColor: colors.danger, borderWidth: 2 },
  // outlineStyle: the field draws its own focus ring; the browser's inner outline is removed on web.
  input: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 16, color: colors.ink, paddingVertical: 12, minHeight: 48, fontVariant: ['tabular-nums'], ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  country: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line, height: 32 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 24, backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 20, gap: 4 },
  countryRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12 },
  box: { flex: 1, maxWidth: 52, height: 56, borderRadius: radius.field, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  hiddenInput: { position: 'absolute', opacity: 0.011, height: 1, width: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignSelf: 'flex-start' },
});
