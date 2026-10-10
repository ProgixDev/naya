import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { ChevronRight, Clock, FlaskConical, Lock } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { useTheme } from '../core/theme';
import { PressableScale } from '../PressableScale';
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
      header={<Header onBack={onBack} />}
      footer={
        <>
          <Button label="Recevoir le code" size="major" full loading={send.isPending} onPress={submit} testID="send-code" />
          <View style={{ paddingHorizontal: 8 }}>{legal}</View>
        </>
      }
    >
      <View style={{ gap: 22, marginTop: onBack ? 0 : 12 }}>
        <AuthIntro title={title} subtitle={subtitle} />
        <PhoneField value={digits} onChangeText={(v) => { setDigits(v); if (error) setError(null); }} country={country} onCountryChange={setCountry} error={error} onSubmitEditing={submit} autoFocus />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
          <Lock size={15} color={colors.success} strokeWidth={2.2} />
          <Text tone="muted" style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>Votre numéro n’est jamais montré à la chauffeuse : les appels passent par Naya.</Text>
        </View>
        {STANDALONE_DEMO ? (
          <PressableScale testID="demo-account" disabled={send.isPending} onPress={() => { haptic.tap(); setError(null); send.mutate(role === 'passenger' ? '+212612345678' : '+212661234567'); }} accessibilityRole="button" accessibilityLabel="Utiliser un compte démo" pressedScale={0.985} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.mauve }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }}><FlaskConical size={20} color={colors.warning} strokeWidth={1.9} /></View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text weight="semibold" tone="accent" style={{ fontSize: 15, lineHeight: 20 }}>Utiliser un compte démo</Text>
              <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Sans SMS, code prérempli</Text>
            </View>
            {send.isPending ? <ActivityIndicator color={colors.accent} /> : <ChevronRight size={18} color={colors.muted} />}
          </PressableScale>
        ) : null}
        {providers}
      </View>
    </Screen>
  );
}

/** Large left-aligned title and supporting line (sign-in steps). */
function AuthIntro({ title, subtitle, action }: { title: string; subtitle: ReactNode; action?: ReactNode }) {
  useTheme();
  return (
    <View style={{ gap: 14, marginTop: 8 }}>
      <View style={{ gap: 6 }}>
        <Text weight="bold" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.8 }}>{title}</Text>
        <Text tone="muted" style={{ fontSize: 16, lineHeight: 23 }}>{subtitle}{action}</Text>
      </View>
    </View>
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
    <Screen keyboard header={<Header onBack={onBack} />} footer={<Button label="Vérifier" size="major" full loading={verify.isPending} disabled={code.length !== 6} onPress={() => verify.mutate(code)} testID="verify-code" />}>
      <View style={{ gap: 22 }}>
        <AuthIntro
          title="Entrez le code"
          subtitle={<>Envoyé par SMS au <Text weight="semibold" numeric style={{ fontSize: 16, lineHeight: 23 }}>{masked}</Text>. </>}
          action={<Text weight="semibold" tone="accent" onPress={onBack} accessibilityRole="link" style={{ fontSize: 16, lineHeight: 23 }}>Modifier</Text>}
        />
        <OTPField value={code} onChange={(v) => { setCode(v); if (error) setError(null); }} error={error} onComplete={(c) => !verify.isPending && verify.mutate(c)} />
        {expired ? <StatusBanner compact tone="warning" title="Code expiré" message="demandez-en un nouveau (valable 5 min)" /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {wait > 0 ? (
            <>
              <Clock size={15} color={colors.muted} strokeWidth={2} />
              <Text tone="muted" numeric accessibilityLiveRegion="polite" style={{ fontSize: 14, lineHeight: 19 }}>Nouveau code dans 0:{String(wait).padStart(2, '0')}</Text>
            </>
          ) : (
            <TextButton label={resend.isPending ? 'Envoi…' : 'Renvoyer le code'} onPress={() => resend.mutate()} testID="resend-code" />
          )}
        </View>
        {Platform.OS === 'ios' ? <Text tone="muted" align="center" style={{ fontSize: 12, lineHeight: 16 }}>Le code reçu par SMS est proposé automatiquement au-dessus du clavier.</Text> : null}
      </View>
    </Screen>
  );
}

export function useAuthProviders() {
  const api = useApi();
  return useQuery({ queryKey: ['naya', 'public', 'auth-providers'], queryFn: api.auth.providers, staleTime: 5 * 60_000 });
}
