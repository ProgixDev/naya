import { useTheme, Button, Header, OTPField, PhoneField, Screen, StatusBanner, Text, TextButton, haptic, toast } from '@naya/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { COUNTRIES, toE164 } from '@naya/domain';
import { errorMessage, isApiError, qk, serverClock } from '@naya/api';
import { useApi } from '@naya/api/react';
import { useAccountId, useMe } from '@/lib/queries';
import { formatPhone } from '@/lib/phone';

const RESEND_SECONDS = 30;

/**
 * Change of phone number from Profil, in two steps: the new number, then the SMS code sent
 * to it. The account (history, wallet, family) stays the same; only the login number changes.
 */
export default function ProfilePhone() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const me = useMe();
  const [country, setCountry] = useState(COUNTRIES[0]!);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(serverClock.now());
  useEffect(() => {
    if (!sentTo) return;
    const t = setInterval(() => setNow(serverClock.now()), 500);
    return () => clearInterval(t);
  }, [sentTo]);

  const e164 = toE164(country, digits);
  const send = useMutation({
    mutationFn: (phone: string) => api.me.requestPhoneChange(phone),
    onSuccess: (r, phone) => {
      setSentTo(phone);
      setResendAt(Date.parse(r.resendAvailableAt));
      // Demo builds send no SMS: the code arrives pre-filled.
      setCode(r.demoCode ?? '');
      setError(null);
    },
    onError: (e, phone) => {
      // A code sent less than 30 s ago is still valid: go on to the code step.
      if (isApiError(e) && e.code === 'OTP_RATE_LIMITED' && !sentTo) {
        setSentTo(phone);
        setResendAt(serverClock.now() + ((e.details?.retryAfterSeconds as number | undefined) ?? RESEND_SECONDS) * 1000);
        return;
      }
      haptic.warning();
      setError(errorMessage(e));
    },
  });
  const verify = useMutation({
    mutationFn: (c: string) => api.me.confirmPhoneChange(sentTo!, c),
    onSuccess: async () => {
      haptic.success();
      await qc.invalidateQueries({ queryKey: qk.me(a) });
      toast('Numéro de téléphone mis à jour', 'success');
      router.back();
    },
    onError: (e) => {
      haptic.error();
      setError(errorMessage(e));
      setCode('');
    },
  });

  const submitNumber = () => {
    if (!e164) {
      haptic.warning();
      setError(`Numéro incomplet. Exemple : ${country.example}`);
      return;
    }
    setError(null);
    send.mutate(e164);
  };
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  if (!sentTo) {
    return (
      <Screen
        keyboard
        testID="profile-phone-screen"
        header={<Header title="Changer de numéro" subtitle={`Numéro actuel : ${formatPhone(me.data?.user.phone) ?? ''}`} onBack={() => router.back()} />}
        footer={<Button label="Recevoir le code" size="major" full loading={send.isPending} onPress={submitNumber} testID="phone-change-send" />}
      >
        <View style={{ gap: 14, marginTop: 16 }}>
          <PhoneField value={digits} onChangeText={(v) => { setDigits(v); if (error) setError(null); }} country={country} onCountryChange={setCountry} error={error} onSubmitEditing={submitNumber} autoFocus />
          <StatusBanner compact tone="neutral" title="Un code sera envoyé au nouveau numéro" message="votre compte, vos trajets et votre portefeuille restent les mêmes. Vous vous connecterez ensuite avec ce numéro." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      testID="profile-phone-code"
      header={<Header title="Entrez le code" subtitle={`Envoyé par SMS au ${formatPhone(sentTo)}`} onBack={() => { setSentTo(null); setCode(''); setError(null); }} />}
      footer={<Button label="Confirmer le nouveau numéro" size="major" full loading={verify.isPending} disabled={code.length !== 6} onPress={() => verify.mutate(code)} testID="phone-change-verify" />}
    >
      <View style={{ gap: 14, marginTop: 18 }}>
        <OTPField value={code} onChange={(v) => { setCode(v); if (error) setError(null); }} error={error} onComplete={(c) => !verify.isPending && verify.mutate(c)} />
        {wait > 0 ? (
          <Text variant="caption" tone="muted" align="center" numeric accessibilityLiveRegion="polite">Nouveau code possible dans {wait} s</Text>
        ) : (
          <TextButton label={send.isPending ? 'Envoi…' : 'Renvoyer le code'} onPress={() => send.mutate(sentTo)} testID="phone-change-resend" />
        )}
        <TextButton label="Modifier le numéro" tone="muted" onPress={() => { setSentTo(null); setCode(''); setError(null); }} />
      </View>
    </Screen>
  );
}
