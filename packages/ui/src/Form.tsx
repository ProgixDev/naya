import { Children, forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import { CalendarDays, Check, ChevronDown, type LucideIcon } from 'lucide-react-native';
import { colors, radius } from '@naya/tokens';
import { COUNTRIES, formatNational, type Country } from '@naya/domain';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { hitSlopFor, useA11yPrefs } from './a11y';
import { haptic } from './haptics';

export interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  /** Shown inside the pill as the placeholder, then floats to the top-left. */
  label: string;
  error?: string | null;
  helper?: string;
  /** Leading glyph inside the pill; unlike `leading` it does not keep the label floated. */
  icon?: LucideIcon;
  leading?: ReactNode;
  trailing?: ReactNode;
  testID?: string;
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Pill input: 56 pt, white, label inside (floats up on focus or value), one line of
 * error under it. Multiline fields keep the language with a 24-pt radius.
 */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, helper, icon: Icon, leading, trailing, onFocus, onBlur, editable = true, testID, inputStyle, value, multiline, placeholder, ...input },
  ref,
) {
  const { reduceMotion } = useA11yPrefs();
  const [focused, setFocused] = useState(false);
  const floated = focused || !!value || !!leading;
  const t = useSharedValue(floated ? 1 : 0);
  useEffect(() => {
    t.value = reduceMotion ? (floated ? 1 : 0) : withTiming(floated ? 1 : 0, { duration: 160 });
  }, [floated, reduceMotion, t]);
  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [0, -12]) }, { scale: interpolate(t.value, [0, 1], [1, 0.76]) }],
  }));
  const radius = multiline ? 22 : 18;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => (ref && typeof ref === 'object' ? ref.current?.focus() : undefined)}
        style={[styles.field, { borderRadius: radius, minHeight: multiline ? 120 : 56, alignItems: multiline ? 'flex-start' : 'center' }, focused && styles.focused, !!error && styles.errorBorder, !editable && { backgroundColor: colors.disabledFill }]}
        accessible={false}
      >
        {Icon ? <Icon size={20} color={error ? colors.danger : focused ? colors.accent : colors.muted} strokeWidth={1.8} style={{ alignSelf: 'center' }} /> : null}
        {leading}
        <View style={{ flex: 1, justifyContent: 'center', alignSelf: 'stretch', paddingTop: multiline ? 22 : 0 }}>
          <Animated.View pointerEvents="none" style={[styles.labelWrap, multiline ? { top: 10 } : null, labelStyle]}>
            <Text variant="label" tone={error ? 'danger' : 'muted'} numberOfLines={1} nativeID={`${testID ?? label}-label`}>
              {label}
            </Text>
          </Animated.View>
          <TextInput
            ref={ref}
            testID={testID}
            value={value}
            editable={editable}
            multiline={multiline}
            placeholder={floated ? placeholder : undefined}
            placeholderTextColor={colors.disabledText}
            accessibilityLabel={label}
            accessibilityHint={error ?? helper}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, multiline ? { paddingTop: 4 } : styles.inputSingle, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null, inputStyle]}
            maxFontSizeMultiplier={1.5}
            {...input}
          />
        </View>
        {trailing}
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ marginLeft: 18 }}>
          {error}
        </Text>
      ) : helper && focused ? (
        <Text variant="caption" tone="muted" style={{ marginLeft: 18 }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

/** Two fields side by side (e.g. Prénom · Nom). Stacks at large text sizes. */
export function FieldRow({ children }: { children: ReactNode }) {
  const { largeText } = useA11yPrefs();
  return <View style={{ flexDirection: largeText ? 'column' : 'row', gap: 10 }}>{Children.map(children, (c) => <View style={{ flex: largeText ? undefined : 1 }}>{c}</View>)}</View>;
}

const pad2 = (s: string) => s.padStart(2, '0');
/** "JJ/MM/AAAA" typed with digits only → ISO "AAAA-MM-JJ" (or partial while typing). */
export function maskDate(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join(' / ');
}
export function isoFromDigits(digits: string): string | null {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 8) return null;
  return `${d.slice(4, 8)}-${pad2(d.slice(2, 4))}-${pad2(d.slice(0, 2))}`;
}
export const digitsFromIso = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}` : '');

export interface DateFieldProps {
  label: string;
  /** ISO date or '' */
  value: string;
  onChange: (iso: string) => void;
  error?: string | null;
  testID?: string;
}

/** Date of birth as one pill with a JJ / MM / AAAA mask and the number pad. */
export function DateField({ label, value, onChange, error, testID }: DateFieldProps) {
  const [digits, setDigits] = useState(() => digitsFromIso(value));
  useEffect(() => {
    if (value && digitsFromIso(value) !== digits) setDigits(digitsFromIso(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <FormField
      icon={CalendarDays}
      label={label}
      testID={testID}
      value={maskDate(digits)}
      placeholder="JJ / MM / AAAA"
      keyboardType="number-pad"
      onChangeText={(t) => {
        const d = t.replace(/\D/g, '').slice(0, 8);
        setDigits(d);
        onChange(isoFromDigits(d) ?? d);
      }}
      error={error}
      maxLength={14}
    />
  );
}

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
  const { reduceMotion } = useA11yPrefs();
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
        leading={
          <PressableScale onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Indicatif ${country.name} ${country.dial}. Changer de pays`} style={styles.country} hitSlop={hitSlopFor(36)}>
            <Text variant="label" weight="semibold" numeric>
              {country.dial}
            </Text>
            <ChevronDown size={16} color={colors.muted} />
          </PressableScale>
        }
      />
      <Modal visible={open} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setOpen(false)}>
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
  field: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(46,32,44,0.07)', paddingHorizontal: 20, gap: 10, shadowColor: colors.ink, shadowOpacity: 0.025, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 0 },
  labelWrap: { position: 'absolute', left: 0, right: 0, transformOrigin: 'left center' },
  focused: { borderColor: colors.accent, borderWidth: 1.5, shadowColor: colors.accent, shadowOpacity: 0.08, shadowRadius: 8 },
  errorBorder: { borderColor: colors.danger, borderWidth: 1.5 },
  // outlineStyle: the field draws its own focus ring; the browser's inner outline is removed on web.
  input: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 16, color: colors.ink, paddingVertical: 12, minHeight: 48, fontVariant: ['tabular-nums'], ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  // Single line: the value sits 8 pt below centre so the floated label has its own row.
  inputSingle: { height: 54, minHeight: 0, paddingTop: 20, paddingBottom: 4 },
  country: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: colors.mauveSoft, marginLeft: -8 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 24, backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 20, gap: 4 },
  countryRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12 },
  box: { flex: 1, maxWidth: 52, height: 60, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(46,32,44,0.07)', alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.025, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 0 },
  hiddenInput: { position: 'absolute', opacity: 0.011, height: 1, width: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(46,32,44,0.07)', alignSelf: 'flex-start', shadowColor: colors.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
});
