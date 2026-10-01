import { useEffect, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
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
import { STANDALONE_DEMO } from '../core/apiBase';

export interface PhoneSignInProps {
  role: MobileRole;
  title: string;
  subtitle: string;
  onCodeSent: (phone: string, demoCode: string | null) => void;
  onBack?: () => void;
  /** Provider buttons shown only when configured (Apple, Google). */
  providers?: ReactNode;
  legal: ReactNode;
  initialPhone?: string;
}

/** Phone number first, +212 selected; consent copy stays at two lines under the action. */
export function PhoneSignInScreen({ role, title, subtitle, onCodeSent, onBack, providers, legal, initialPhone }: PhoneSignInProps) {
  const api = useApi();
  const initialCountry = COUNTRIES.find((c) => initialPhone?.startsWith(c.dial)) ?? COUNTRIES[0]!;
  const [country, setCountry] = useState(initialCountry);
  const [digits, setDigits] = useState(initialPhone ? initialPhone.slice(initialCountry.dial.length) : '');
  const [error, setError] = useState<string | null>(null);
  const e164 = toE164(country, digits);
  const send = useMutation({
    mutationFn: (phone: string) => api.auth.requestOtp(phone, role),
    onSuccess: (r, phone) => onCodeSent(phone, r.demoCode),
    onError: (e, phone) => {
      // A code sent less than 30 s ago is still valid: continue to the code screen.
      if (isApiError(e) && e.code === 'OTP_RATE_LIMITED') return onCodeSent(phone, null);
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
          <Button label="Recevoir le code" size="major" full loading={send.isPending} onPress={submit} testID="send-code" />
          <View style={{ paddingHorizontal: 8 }}>{legal}</View>
        </>
      }
    >
      <View style={{ gap: 14, marginTop: 16 }}>
        <PhoneField value={digits} onChangeText={(v) => { setDigits(v); if (error) setError(null); }} country={country} onCountryChange={setCountry} error={error} onSubmitEditing={submit} autoFocus />
        {STANDALONE_DEMO ? <View style={{ gap: 12 }}>
          <Text variant="caption" tone="muted">Démo sur votre appareil. Aucun SMS n’est envoyé ; le code est prérempli.</Text>
          <Button label="Utiliser un compte démo" variant="secondary" full loading={send.isPending} testID="demo-account" onPress={() => { setError(null); send.mutate(role === 'passenger' ? '+212612345678' : '+212661234567'); }} />
        </View> : null}
        {providers}
      </View>
    </Screen>
  );
}

export interface OtpProps {
  role: MobileRole;
  phone: string;
  demoCode: string | null;
  onVerified: (token: string, accountId: string, isNew: boolean) => void;
  onBack: () => void;
}

const RESEND_SECONDS = 30;

export function OtpScreen({ role, phone, demoCode, onVerified, onBack }: OtpProps) {
  const api = useApi();
  // Demo builds send no SMS: the code arrives pre-filled so sign-in is one tap.
  const [code, setCode] = useState(demoCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [resendAt, setResendAt] = useState(() => serverClock.now() + RESEND_SECONDS * 1000);
  const [now, setNow] = useState(serverClock.now());
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
      setExpired(isApiError(e) && e.code === 'OTP_EXPIRED');
      setError(errorMessage(e));
      setCode('');
    },
  });
  const resend = useMutation({
    mutationFn: () => api.auth.requestOtp(phone, role),
    onSuccess: (r) => {
      setResendAt(Date.parse(r.resendAvailableAt));
      if (r.demoCode) setCode(r.demoCode);
      setError(null);
      setExpired(false);
    },
    onError: (e) => {
      const retry = isApiError(e) ? (e.details?.retryAfterSeconds as number | undefined) : undefined;
      if (retry) setResendAt(serverClock.now() + retry * 1000);
      setError(errorMessage(e));
    },
  });
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const masked = phone.replace(/^(\+\d{3})(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5 $6');
  return (
    <Screen keyboard header={<Header title="Entrez le code" subtitle={`Envoyé par SMS au ${masked}`} onBack={onBack} />} footer={<Button label="Vérifier" size="major" full loading={verify.isPending} disabled={code.length !== 6} onPress={() => verify.mutate(code)} testID="verify-code" />}>
      <View style={{ gap: 14, marginTop: 18 }}>
        <OTPField value={code} onChange={(v) => { setCode(v); if (error) setError(null); }} error={error} onComplete={(c) => !verify.isPending && verify.mutate(c)} />
        {expired ? <StatusBanner compact tone="warning" title="Code expiré" message="demandez-en un nouveau (valable 5 min)" /> : null}
        {wait > 0 ? (
          <Text variant="caption" tone="muted" align="center" numeric accessibilityLiveRegion="polite">
            Nouveau code possible dans {wait} s
          </Text>
        ) : (
          <TextButton label={resend.isPending ? 'Envoi…' : 'Renvoyer le code'} onPress={() => resend.mutate()} testID="resend-code" />
        )}
        {Platform.OS === 'ios' ? (
          <Text variant="micro" tone="muted" align="center">
            Le code reçu par SMS est proposé automatiquement au-dessus du clavier.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

export function useAuthProviders() {
  const api = useApi();
  return useQuery({ queryKey: ['naya', 'public', 'auth-providers'], queryFn: api.auth.providers, staleTime: 5 * 60_000 });
}
