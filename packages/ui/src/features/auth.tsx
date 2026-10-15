import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@naya/tokens';
import { useMutation, useQuery } from '@tanstack/react-query';
import { COUNTRIES, toE164, type MobileRole } from '@naya/domain';
import { errorMessage, isApiError, serverClock } from '@naya/api';
import { useApi } from '@naya/api/react';
import { Screen } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button, TextButton } from '../Button';
import { OTPField, PhoneField } from '../Form';
import { StatusBanner } from '../Feedback';
import { haptic } from '../haptics';
import { useTheme } from '../core/theme';

/* ───────── Sign-in code ─────────
 * The code screen verifies on the 6th digit, with no « Vérifier » button (R16), and never shows, suggests or prefills a code. Mock builds send no SMS
 * and the API accepts any 6-digit code (ADR-0058); with NAYA_DEV=0 only the code the API generated (printed to its
 * console) signs in. OTPField keeps iOS one-time-code and Android SMS autofill for a real SMS provider. */

export interface PhoneSignInProps {
  role: MobileRole;
  title: string;
  subtitle: string;
  onCodeSent: (phone: string) => void;
  onBack?: () => void;
  /** Provider buttons shown only when configured (Apple, Google). */
  providers?: ReactNode;
  legal: ReactNode;
  initialPhone?: string;
}

/**
 * Phone number first, +212 selected; consent copy stays at two lines under the action. Any valid number signs in or
 * opens an account. The action stays disabled (neutral fill) until the number is complete (P-04) and is pinned above
 * the keyboard by the Screen footer (P-06).
 */
export function PhoneSignInScreen({ role, title, subtitle, onCodeSent, onBack, providers, legal, initialPhone }: PhoneSignInProps) {
  const api = useApi();
  const initialCountry = COUNTRIES.find((c) => initialPhone?.startsWith(c.dial)) ?? COUNTRIES[0]!;
  const [country, setCountry] = useState(initialCountry);
  const [digits, setDigits] = useState(initialPhone ? initialPhone.slice(initialCountry.dial.length) : '');
  const [error, setError] = useState<string | null>(null);
  const e164 = toE164(country, digits);
  const send = useMutation({
    mutationFn: (phone: string) => api.auth.requestOtp(phone, role),
    onSuccess: (_r, phone) => onCodeSent(phone),
    onError: (e, phone) => {
      // A code sent less than 30 s ago is still valid: continue to the code screen.
      if (isApiError(e) && e.code === 'OTP_RATE_LIMITED') return onCodeSent(phone);
      setError(errorMessage(e));
    },
  });
  const submit = () => {
    if (!e164) {
      setError(`Numéro incomplet. Exemple : ${country.example}`);
      haptic.warning();
      return;
    }
    setError(null);
    send.mutate(e164);
  };
  return (
    <Screen
      keyboard
      header={<Header title={title} subtitle={subtitle} onBack={onBack} />}
      footer={
        <>
          <Button label="Recevoir le code" full loading={send.isPending} disabled={!e164} onPress={submit} testID="send-code" />
          <View style={{ paddingHorizontal: 8 }}>{legal}</View>
        </>
      }
    >
      <View style={{ gap: 14, marginTop: 12 }}>
        <PhoneField value={digits} onChangeText={(v) => { setDigits(v); if (error) setError(null); }} country={country} onCountryChange={setCountry} error={error} onSubmitEditing={submit} autoFocus />
        {providers}
      </View>
    </Screen>
  );
}

export type LegalDocument = 'terms' | 'privacy';

/**
 * The consent line under « Recevoir le code » (PAX-18). The two documents' words become underlined links once the
 * app can show them (`onOpen`); without it the line stays plain text, so it never points to a page that does not exist.
 */
export function LegalConsent({ terms = 'conditions d’utilisation', onOpen }: { terms?: string; onOpen?: (doc: LegalDocument) => void }) {
  const link = (doc: LegalDocument, text: string) =>
    onOpen ? (
      <Text variant="micro" tone="accent" weight="semibold" accessibilityRole="link" onPress={() => onOpen(doc)} style={{ textDecorationLine: 'underline' }} testID={`legal-${doc}`}>
        {text}
      </Text>
    ) : (
      text
    );
  return (
    <Text variant="micro" tone="muted" align="center" testID="legal-consent">
      En continuant, vous acceptez les {link('terms', terms)} et la {link('privacy', 'politique de confidentialité')} de Naya.
    </Text>
  );
}

export interface OtpProps {
  role: MobileRole;
  phone: string;
  onVerified: (token: string, accountId: string, isNew: boolean) => void;
  onBack: () => void;
}

const RESEND_SECONDS = 30;

/** A wrong or expired code clears the boxes; a network or server failure keeps the code and offers « Réessayer ». */
const keepsCode = (e: unknown) => !isApiError(e) || e.status === 0 || e.status >= 500;

/**
 * The code verifies itself at the 6th digit (R16): no « Vérifier » button. One request at a time: a second
 * completion (paste then SMS autofill) is ignored while one is in flight. A wrong code clears the boxes so the
 * next six digits verify again; a failure that is not the code's fault keeps it and shows « Réessayer ».
 * « Renvoyer le code » stays as text.
 */
export function OtpScreen({ role, phone, onVerified, onBack }: OtpProps) {
  useTheme();
  const api = useApi();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [retry, setRetry] = useState(false);
  const [resendAt, setResendAt] = useState(() => serverClock.now() + RESEND_SECONDS * 1000);
  const [now, setNow] = useState(serverClock.now());
  const inFlight = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(serverClock.now()), 500);
    return () => clearInterval(t);
  }, []);
  const verify = useMutation({
    mutationFn: (c: string) => api.auth.verifyOtp(phone, role, c),
    onSuccess: (r) => {
      haptic.success();
      onVerified(r.token, r.user.id, r.isNew);
    },
    onError: (e) => {
      haptic.error();
      const keep = keepsCode(e);
      setRetry(keep);
      setExpired(isApiError(e) && e.code === 'OTP_EXPIRED');
      setError(errorMessage(e));
      if (!keep) setCode('');
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const submit = (c: string) => {
    if (inFlight.current || c.length !== 6) return;
    inFlight.current = true;
    setRetry(false);
    setError(null);
    verify.mutate(c);
  };
  const resend = useMutation({
    mutationFn: () => api.auth.requestOtp(phone, role),
    onSuccess: (r) => {
      setResendAt(Date.parse(r.resendAvailableAt));
      setCode('');
      setError(null);
      setExpired(false);
      setRetry(false);
    },
    onError: (e) => {
      const after = isApiError(e) ? (e.details?.retryAfterSeconds as number | undefined) : undefined;
      if (after) setResendAt(serverClock.now() + after * 1000);
      setError(errorMessage(e));
    },
  });
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const masked = phone.replace(/^(\+\d{3})(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5 $6');
  return (
    <Screen keyboard header={<Header title="Entrez le code" subtitle={`Envoyé par SMS au ${masked}`} onBack={onBack} />}>
      <View style={{ gap: 14, marginTop: 12 }}>
        <OTPField
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error && !verify.isPending) {
              setError(null);
              setRetry(false);
            }
          }}
          error={error}
          onComplete={submit}
        />
        {verify.isPending ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 }} accessibilityLiveRegion="polite" testID="verify-pending">
            <ActivityIndicator color={colors.accent} />
            <Text variant="caption" tone="muted">
              Vérification…
            </Text>
          </View>
        ) : retry && code.length === 6 ? (
          <Button label="Réessayer" variant="secondary" full onPress={() => submit(code)} testID="verify-code" />
        ) : null}
        {expired ? <StatusBanner compact tone="warning" title="Code expiré" message="demandez-en un nouveau (valable 5 min)" /> : null}
        {verify.isPending ? null : wait > 0 ? (
          <Text variant="caption" tone="muted" align="center" numeric accessibilityLiveRegion="polite">
            Nouveau code possible dans {wait} s
          </Text>
        ) : (
          <TextButton label={resend.isPending ? 'Envoi…' : 'Renvoyer le code'} onPress={() => resend.mutate()} testID="resend-code" />
        )}
      </View>
    </Screen>
  );
}

export function useAuthProviders() {
  const api = useApi();
  return useQuery({ queryKey: ['naya', 'public', 'auth-providers'], queryFn: api.auth.providers, staleTime: 5 * 60_000 });
}
