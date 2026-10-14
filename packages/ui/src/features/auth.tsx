import { useEffect, useEffectEvent, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { MessageCircle } from 'lucide-react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { COUNTRIES, toE164, type MobileRole } from '@naya/domain';
import { errorMessage, isApiError, serverClock } from '@naya/api';
import { useApi } from '@naya/api/react';
import { colors, radius, shadow, themedStyles } from '@naya/tokens';
import { useTheme } from '../core/theme';
import { Screen } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button, TextButton } from '../Button';
import { OTPField, PhoneField } from '../Form';
import { StatusBanner } from '../Feedback';
import { PressableScale } from '../PressableScale';
import { useA11yPrefs } from '../a11y';
import { haptic } from '../haptics';

/* ───────── Sign-in code delivery ─────────
 * There is no SMS provider. When the API runs in dev mode it returns the code it generated
 * (`demoCode`, the fixed mock code), and the app hands it over the way a text message would
 * arrive: a local notification from « Naya » a moment later or, when notifications are not
 * allowed (and on the web), a message card on the code screen. Tapping either fills the code.
 * Without a returned code (API with NAYA_DEV=0) nothing is delivered on the device. */

const SMS_DELAY_MS = 1600;
const CODE_NOTIFICATION = 'naya-sign-in-code';

interface CodeMessage {
  seq: number;
  code: string;
  /** null while the message is on its way. */
  channel: 'notification' | 'inApp' | null;
  notificationId: string | null;
}

let inbox: Record<string, CodeMessage> = {};
let seq = 0;
const inboxListeners = new Set<() => void>();
const inboxKey = (role: MobileRole, phone: string) => `${role}:${phone}`;
const emitInbox = () => inboxListeners.forEach((l) => l());
const subscribeInbox = (listener: () => void) => {
  inboxListeners.add(listener);
  return () => { inboxListeners.delete(listener); };
};
function patchMessage(key: string, at: number, patch: Partial<CodeMessage>) {
  const current = inbox[key];
  if (!current || current.seq !== at) return; // A newer code replaced it.
  inbox = { ...inbox, [key]: { ...current, ...patch } };
  emitInbox();
}
function forgetNotification(id: string | null) {
  if (!id || Platform.OS === 'web') return;
  Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  Notifications.dismissNotificationAsync(id).catch(() => undefined);
}
/** After sign-in the code is useless: drop the message and its notification. */
function clearMessage(key: string) {
  const current = inbox[key];
  if (!current) return;
  forgetNotification(current.notificationId);
  const rest = { ...inbox };
  delete rest[key];
  inbox = rest;
  emitInbox();
}

async function notificationsAllowed() {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.status !== 'undetermined' || !current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Delivers a sign-in code like an incoming text message. Never throws. */
async function deliverSignInCode(role: MobileRole, phone: string, code: string) {
  const key = inboxKey(role, phone);
  const at = ++seq;
  const sentAt = Date.now();
  forgetNotification(inbox[key]?.notificationId ?? null);
  inbox = { ...inbox, [key]: { seq: at, code, channel: null, notificationId: null } };
  emitInbox();
  if (await notificationsAllowed()) {
    try {
      // Shown while the app is open too, like a text message banner.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      const seconds = Math.round((SMS_DELAY_MS - (Date.now() - sentAt)) / 1000);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: 'Naya', body: `Votre code de connexion Naya : ${code}`, sound: 'default', data: { kind: CODE_NOTIFICATION, role, phone, code } },
        trigger: seconds >= 1 ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds } : null,
      });
      patchMessage(key, at, { channel: 'notification', notificationId });
      return;
    } catch {
      // Falls back to the message card below.
    }
  }
  setTimeout(() => patchMessage(key, at, { channel: 'inApp' }), Math.max(0, SMS_DELAY_MS - (Date.now() - sentAt)));
}

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

/** Phone number first, +212 selected; consent copy stays at two lines under the action. Any valid number signs in or opens an account. */
export function PhoneSignInScreen({ role, title, subtitle, onCodeSent, onBack, providers, legal, initialPhone }: PhoneSignInProps) {
  const api = useApi();
  const initialCountry = COUNTRIES.find((c) => initialPhone?.startsWith(c.dial)) ?? COUNTRIES[0]!;
  const [country, setCountry] = useState(initialCountry);
  const [digits, setDigits] = useState(initialPhone ? initialPhone.slice(initialCountry.dial.length) : '');
  const [error, setError] = useState<string | null>(null);
  const e164 = toE164(country, digits);
  const send = useMutation({
    mutationFn: (phone: string) => api.auth.requestOtp(phone, role),
    onSuccess: (r, phone) => {
      if (r.demoCode) void deliverSignInCode(role, phone, r.demoCode);
      onCodeSent(phone);
    },
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
          <Button label="Recevoir le code" size="major" full loading={send.isPending} onPress={submit} testID="send-code" />
          <View style={{ paddingHorizontal: 8 }}>{legal}</View>
        </>
      }
    >
      <View style={{ gap: 14, marginTop: 16 }}>
        <PhoneField value={digits} onChangeText={(v) => { setDigits(v); if (error) setError(null); }} country={country} onCountryChange={setCountry} error={error} onSubmitEditing={submit} autoFocus />
        {providers}
      </View>
    </Screen>
  );
}

export interface OtpProps {
  role: MobileRole;
  phone: string;
  onVerified: (token: string, accountId: string, isNew: boolean) => void;
  onBack: () => void;
}

const RESEND_SECONDS = 30;

export function OtpScreen({ role, phone, onVerified, onBack }: OtpProps) {
  const api = useApi();
  const key = inboxKey(role, phone);
  const readMessage = () => inbox[key] ?? null;
  const message = useSyncExternalStore(subscribeInbox, readMessage, readMessage);
  const [code, setCode] = useState('');
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
      clearMessage(key);
      onVerified(r.token, r.user.id, r.isNew);
    },
    onError: (e) => {
      haptic.error();
      setExpired(isApiError(e) && e.code === 'OTP_EXPIRED');
      setError(errorMessage(e));
      setCode('');
    },
  });
  /** Tapping the message fills the code, as the keyboard suggestion does for a real text message. */
  const fill = (c: string) => {
    setCode(c);
    setError(null);
    if (!verify.isPending) verify.mutate(c);
  };
  const onNotificationTap = useEffectEvent((r: Notifications.NotificationResponse) => {
    const d = r.notification.request.content.data as { kind?: string; role?: string; phone?: string; code?: string } | undefined;
    if (d?.kind === CODE_NOTIFICATION && d.role === role && d.phone === phone && d.code) fill(d.code);
  });
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => onNotificationTap(r));
    return () => sub.remove();
  }, []);
  const resend = useMutation({
    mutationFn: () => api.auth.requestOtp(phone, role),
    onSuccess: (r) => {
      setResendAt(Date.parse(r.resendAvailableAt));
      if (r.demoCode) void deliverSignInCode(role, phone, r.demoCode);
      setCode('');
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
        {message?.channel === 'inApp' ? <IncomingCodeMessage key={message.seq} code={message.code} onPress={() => fill(message.code)} /> : null}
        <OTPField value={code} onChange={(v) => { setCode(v); if (error) setError(null); }} error={error} onComplete={(c) => !verify.isPending && verify.mutate(c)} />
        {expired ? <StatusBanner compact tone="warning" title="Code expiré" message="demandez-en un nouveau (valable 5 min)" /> : null}
        {wait > 0 ? (
          <Text variant="caption" tone="muted" align="center" numeric accessibilityLiveRegion="polite">
            Nouveau code possible dans {wait} s
          </Text>
        ) : (
          <TextButton label={resend.isPending ? 'Envoi…' : 'Renvoyer le code'} onPress={() => resend.mutate()} testID="resend-code" />
        )}
        {/* Only true for a text message sent by an SMS provider; a code delivered on the device is filled by tapping it. */}
        {Platform.OS === 'ios' && !message ? (
          <Text variant="micro" tone="muted" align="center">
            Le code reçu par SMS est proposé automatiquement au-dessus du clavier.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

/** The code as a text message would show it, when notifications are off and on the web. */
function IncomingCodeMessage({ code, onPress }: { code: string; onPress: () => void }) {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  // VoiceOver keeps focus on the code field and ignores live regions: say that the message arrived.
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`Nouveau message de Naya : votre code est ${code.split('').join(' ')}`);
  }, [code]);
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(220)}>
      <PressableScale
        onPress={onPress}
        style={styles.message}
        accessibilityRole="button"
        accessibilityLabel={`Nouveau message · Naya : votre code est ${code}`}
        accessibilityHint="Saisit ce code et vous connecte"
        accessibilityLiveRegion="polite"
        testID="sms-code"
      >
        <View style={styles.messageIcon}>
          <MessageCircle size={16} color={colors.inverse} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="micro" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
              Nouveau message · Naya
            </Text>
            <Text variant="micro" tone="muted">
              maintenant
            </Text>
          </View>
          <Text variant="caption" tone="ink">
            Votre code est{' '}
            <Text variant="caption" weight="semibold" numeric>
              {code}
            </Text>
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  message: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.row, backgroundColor: colors.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow.card },
  messageIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
}));

export function useAuthProviders() {
  const api = useApi();
  return useQuery({ queryKey: ['naya', 'public', 'auth-providers'], queryFn: api.auth.providers, staleTime: 5 * 60_000 });
}
