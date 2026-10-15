import { useTheme } from './../core/theme';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Linking, Share, StyleSheet, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { errorMessage } from '@naya/api';
import { formatMoney, formatShort, parseMoneyInput, statusA11y, walletEntryStatus, type DemoPaymentOption, type LatLng, type PassengerWalletEntry, type SafetyAlert } from '@naya/domain';
import { colors, getColorScheme, radius, shadow, themedStyles } from '@naya/tokens';
import { ArrowDownLeft, Car, CreditCard, Droplets, MapPin, Phone, Share2, Siren, Smartphone, Store, type LucideIcon } from 'lucide-react-native';
import { STANDALONE_DEMO } from '../core/apiBase';
import { isUncertainFailure, useSingleFlight } from '../core/useSingleFlight';
import { Screen, Section } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button } from '../Button';
import { FormField, Pill } from '../Form';
import { StatusBanner, ErrorState, Skeleton } from '../Feedback';
import { Sheet } from '../BottomSheet';
import { toast, useScreenFocus, useToastAnchor } from '../Toast';
import { haptic } from '../haptics';
import { useA11yPrefs } from '../a11y';
import { PressableScale } from '../PressableScale';
import { GlossLayers, glossShadow } from '../Material';
import { Icon } from '../Icon';
import { StatusIcon } from '../StatusIcon';
import { IconDisc, ListGroup, ListRow } from '../List';
import { Money } from '../Ride';

const styles = themedStyles(() =>
  StyleSheet.create({
    balance: {
      backgroundColor: colors.selected,
      borderRadius: radius.card,
      padding: 20,
      gap: 4,
    },
    // R10, audit P-57: full-width 56, held 1.5 s; the fill shows how long is left.
    hold: {
      minHeight: 56,
      borderRadius: 28,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 22,
    },
    // X-02: the pinned safety disc and its label, on the map's right edge.
    disc: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
    },
    discLabel: {
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: colors.elevated,
    },
    entry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 72,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
  }),
);

/* ───────────── Hold to confirm ───────────── */

/**
 * A full-width 56 danger button held for `durationMs` (R10: 1.5 s) before it fires, with a
 * progress fill and a haptic at the start and at the end. Releasing early cancels and says how
 * to send. Screen readers get an `activate` action instead (double-tap sends at once), since a
 * timed hold is not usable with VoiceOver or TalkBack.
 */
export function HoldToConfirmButton({
  label,
  holdingLabel = 'Continuez à maintenir…',
  hint,
  onConfirm,
  loading,
  disabled,
  durationMs = 1500,
  accessibilityLabel,
  testID,
}: {
  label: string;
  holdingLabel?: string;
  /** Shown after an early release, and read as the accessibility hint. */
  hint: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  durationMs?: number;
  /** The action read by screen readers (the visible label says « maintenez »). */
  accessibilityLabel: string;
  testID?: string;
}) {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [holding, setHolding] = useState(false);
  const [released, setReleased] = useState(false);
  const fired = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactive = !!loading || !!disabled;
  const confirm = () => {
    if (inactive) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    fired.current = true;
    setHolding(false);
    setReleased(false);
    haptic.warning();
    onConfirm();
    progress.setValue(0);
  };
  const start = () => {
    if (inactive) return;
    fired.current = false;
    setHolding(true);
    setReleased(false);
    haptic.tap();
    progress.setValue(0);
    // The timer decides; the fill only shows it. The fill is the only sign of how long is left, so
    // it runs under Reduce Motion too (linear, no bounce); only the release snaps back without animating.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!fired.current) confirm();
    }, durationMs);
    Animated.timing(progress, { toValue: 1, duration: durationMs, easing: Easing.linear, useNativeDriver: true }).start();
  };
  const stop = () => {
    if (fired.current || inactive) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    progress.stopAnimation();
    setHolding(false);
    setReleased(true);
    if (reduceMotion) progress.setValue(0);
    else Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      progress.stopAnimation();
    },
    [progress],
  );
  const dark = getColorScheme() === 'dark';
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate' || e.nativeEvent.actionName === 'longpress') confirm();
  };
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }}>
      <PressableScale
        testID={testID}
        onPressIn={start}
        onPressOut={stop}
        pressedScale={1}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hint}
        accessibilityState={{ disabled: inactive, busy: !!loading }}
        accessibilityActions={[{ name: 'activate', label: accessibilityLabel }, { name: 'longpress', label: accessibilityLabel }]}
        onAccessibilityAction={onAction}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.hold, disabled ? { backgroundColor: colors.disabledFill } : glossShadow('danger')]}
      >
        {disabled ? null : <GlossLayers tone="danger" radius={28} />}
        <Animated.View
          pointerEvents="none"
          testID={testID ? `${testID}-progress` : undefined}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.26)',
              transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-(width || 400), 0] }) }],
            },
          ]}
        />
        {loading ? (
          <ActivityIndicator color={colors.inverse} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Siren size={20} color={disabled ? colors.disabledText : colors.inverse} strokeWidth={2} />
            <Text variant="action" tone={disabled ? 'disabled' : 'inverse'} maxFontSizeMultiplier={1.4} style={{ fontSize: 17, flexShrink: 1 }} align="center">
              {holding ? holdingLabel : label}
            </Text>
          </View>
        )}
      </PressableScale>
      {released ? (
        <Text variant="caption" tone="muted" align="center" accessibilityLiveRegion="polite" testID={testID ? `${testID}-hint` : undefined}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/* ───────────── Safety: pinned disc and SOS sheet ───────────── */

/** SOS actions, worded as the server records them (services/demo-api/src/services/prototype.ts). */
const CALLED_POLICE = 'Appel au 19 lancé';
const SHARED_POSITION = 'Position partagée avec un proche';
/** How long a retry after an unanswered SOS resends that attempt's position (UI-17). */
const SOS_REPLAY_MS = 60_000;
type SosBody = {
  rideId: string | null;
  familyTripId: string | null;
  location: LatLng;
  contactName: string;
};
const mapsLink = (l: LatLng) =>
  `https://maps.google.com/?q=${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;

export interface SafetyProps {
  rideId?: string | null;
  familyTripId?: string | null;
  /** The position sent with the alert. */
  location: LatLng;
  /**
   * Where that position is, in words (« Votre position, près de Gare Rabat Ville »). The sheet never
   * shows raw coordinates (audit P-57); without a label it says only that the position is attached.
   */
  locationLabel?: string;
  /** Rendered at the end of the sheet: the app's other emergency numbers, for example. */
  extra?: ReactNode;
}

/**
 * SOS from a ride or a Naya Famille trip. The alert and the position are saved on the server.
 * Connected builds reach the admin SOS desk, and its answer shows here while the sheet is open.
 * A standalone build has no desk on the other end: the copy says the alert is recorded and
 * never claims a team was notified (ADR-0058). The 19 is a real call; « Prévenir un proche » opens
 * the phone's share sheet. Failures use Alert.alert so they are seen whatever layer is on top.
 * The alert is sent by holding the red button 1.5 s (R10).
 */
export function SafetySheet({ visible, onClose, rideId = null, familyTripId = null, location, locationLabel, extra }: SafetyProps & { visible: boolean; onClose: () => void }) {
  useTheme();
  const api = useApi();
  const [sos, setSos] = useState<SafetyAlert | null>(null);
  const [contact, setContact] = useState('');
  const desk = !STANDALONE_DEMO;
  const live = useQuery({
    queryKey: ['naya', sos?.userId ?? '', 'sos'],
    queryFn: api.prototype.alerts,
    enabled: desk && visible && !!sos,
    refetchInterval: 5000,
  });
  const fresh = live.data?.find((a) => a.id === sos?.id);
  const shown =
    fresh && sos && fresh.actions.length >= sos.actions.length ? fresh : sos;
  const raise = useSingleFlight(
    (body: SosBody, k) => api.prototype.sos(body, k),
    {
      onSuccess: (alert) => {
        haptic.success();
        setSos(alert);
      },
      // No reset here: after a network error or a timeout the retry keeps the same
      // Idempotency-Key, so an alert the server did record is not raised twice (UI-17).
      onError: (e) => {
        haptic.error();
        // Without an answer the server may still have recorded the alert: do not say it was
        // not sent. A retry replays it rather than raising a second one.
        Alert.alert(
          isUncertainFailure(e) ? 'Alerte non confirmée' : 'Alerte non envoyée',
          isUncertainFailure(e)
            ? `${errorMessage(e)} Réessayez. En cas de danger, appelez le 19.`
            : `${errorMessage(e)} En cas de danger, appelez le 19.`,
        );
      },
    },
  );
  const trigger = () => {
    const contactName = contact.trim() || 'Aucun proche indiqué';
    // The position moves during a ride. A prompt retry after an unanswered attempt resends
    // that attempt's body, so the server replays it instead of refusing a changed body. After
    // SOS_REPLAY_MS the current position matters more: a fresh body, hence a new key.
    const last = raise.variables;
    const retry =
      raise.isError &&
      isUncertainFailure(raise.error) &&
      Date.now() - raise.submittedAt < SOS_REPLAY_MS &&
      last !== undefined &&
      last.rideId === rideId &&
      last.familyTripId === familyTripId &&
      last.contactName === contactName;
    raise.run(retry ? last : { rideId, familyTripId, location, contactName });
  };
  const record = (action: string) => {
    if (!sos) return;
    api.prototype
      .safetyAction(sos.id, action)
      .then((next) => {
        setSos(next);
        if (desk) live.refetch();
      })
      .catch(() => undefined);
  };
  const callPolice = () => {
    // On a Famille trip the call is also written in the trip journal, as the removed « Police 19 » button did.
    // The call itself never waits for it: someone may really need it.
    if (familyTripId) api.prototype.familyCall(familyTripId, 'police').catch(() => undefined);
    Linking.openURL('tel:19')
      .then(() => record(CALLED_POLICE))
      .catch(() =>
        Alert.alert(
          'Appel impossible depuis cet appareil',
          'Composez le 19 depuis un téléphone.',
        ),
      );
  };
  const sharePosition = async () => {
    try {
      const r = await Share.share({
        message: `SOS Naya : j’ai besoin d’aide. Ma position : ${mapsLink(location)}`,
      });
      if (r.action === Share.sharedAction) record(SHARED_POSITION);
    } catch {
      Alert.alert(
        'Partage impossible',
        'Envoyez votre position depuis Plans ou Messages.',
      );
    }
  };
  // One banner says what happened (principle 9). Connected: the server's state (C16), never a
  // timer. Standalone: recorded only, since no desk receives it.
  const recorded = shown ? (
    desk ? (
      <StatusBanner
        kind="safetyAlert"
        state={shown.status}
        title={`Alerte ${shown.id} ${shown.status === 'new' ? 'enregistrée' : shown.status === 'responding' ? 'prise en charge' : 'résolue'}`}
        message={
          shown.status === 'new'
            ? 'Transmise à l’équipe sécurité Naya avec votre position.'
            : shown.status === 'responding'
              ? `${shown.ownerName ?? 'L’équipe sécurité Naya'} suit votre alerte.`
              : shown.resolutionNote || 'L’équipe sécurité Naya a clôturé l’alerte.'
        }
        testID="sos-recorded"
      />
    ) : (
      <StatusBanner
        tone="success"
        title={`Alerte ${shown.id} enregistrée`}
        message="Votre position est jointe à l’alerte. En cas de danger, appelez le 19."
        testID="sos-recorded"
      />
    )
  ) : null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!raise.isPending}
      title="Sécurité"
      subtitle={
        // Before the alert exists, say what the button will do; afterwards the banner says what was done.
        !shown
          ? desk
            ? 'Maintenez le bouton rouge : l’alerte et votre position partent à l’équipe sécurité Naya.'
            : 'Maintenez le bouton rouge : l’alerte est enregistrée avec votre position sur ce trajet.'
          : undefined
      }
      testID="sos-sheet"
    >
      <View style={{ gap: 12, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible accessibilityLabel={`Position jointe à l’alerte : ${locationLabel ?? 'position du trajet'}`} testID="sos-location">
          <Icon icon={MapPin} size={16} tone="neutral" />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {locationLabel ?? 'La position du trajet est jointe à l’alerte.'}
          </Text>
        </View>
        {!shown ? (
          <>
            <HoldToConfirmButton
              label="Maintenez pour alerter"
              accessibilityLabel="Envoyer l’alerte de sécurité"
              hint="Gardez le doigt sur le bouton 1,5 seconde pour envoyer l’alerte."
              loading={raise.isPending}
              onConfirm={trigger}
              testID="confirm-sos"
            />
            <Button
              label="Appeler le 19"
              accessibilityHint="Police. Appelle le 19 depuis votre téléphone."
              icon={<Phone size={18} color={colors.accent} strokeWidth={2} />}
              variant="secondary"
              full
              onPress={callPolice}
              testID="sos-call-police"
            />
            <FormField
              label="Proche de confiance (facultatif)"
              helper="Son nom est joint à l’alerte. Vous pourrez prévenir cette personne ensuite."
              value={contact}
              onChangeText={setContact}
              autoCapitalize="words"
              testID="sos-contact"
            />
          </>
        ) : (
          <>
            {recorded}
            <Button
              label="Appeler le 19"
              accessibilityHint="Police. Appelle le 19 depuis votre téléphone."
              icon={<Phone size={18} color={colors.inverse} strokeWidth={2} />}
              variant="danger"
              full
              onPress={callPolice}
              testID="sos-call-police"
            />
            <Button
              label="Prévenir un proche"
              icon={<Share2 size={18} color={colors.accent} strokeWidth={2} />}
              variant="secondary"
              full
              onPress={sharePosition}
              testID="sos-share"
            />
            {shown.actions.map((a, i) => (
              <Text key={i} variant="caption" tone="muted">
                {formatShort(a.at)} · {a.label}
              </Text>
            ))}
          </>
        )}
        {extra}
      </View>
    </Sheet>
  );
}

/**
 * The pinned safety entry (X-02): a 44 `Siren` disc labelled « Sécurité », for the map's right edge
 * in both apps. The caller positions it (`style`), outside any scroll view, so it never scrolls away;
 * it keeps top toasts below itself so they never cover it. It opens the SOS sheet.
 */
export function SafetyDisc({ style, testID = 'sos', anchorToasts = true, ...props }: SafetyProps & { style?: StyleProp<ViewStyle>; testID?: string; anchorToasts?: boolean }) {
  useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);
  const focused = useScreenFocus();
  const [below, setBelow] = useState<number | null>(null);
  useToastAnchor(anchorToasts && below !== null ? { top: below } : null, focused);
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[{ alignItems: 'center' }, style]}
      pointerEvents="box-none"
      onLayout={() =>
        ref.current?.measureInWindow?.((_x, y, _w, h) => {
          if (Number.isFinite(y) && Number.isFinite(h) && h > 0) setBelow(Math.round(y + h + 8));
        })
      }
    >
      <PressableScale
        testID={testID}
        onPress={() => {
          haptic.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Sécurité"
        accessibilityHint="Ouvre l’alerte de sécurité et l’appel au 19"
        style={{ alignItems: 'center' }}
      >
        <View style={[styles.disc, shadow.card]}>
          <Siren size={22} color={colors.danger} strokeWidth={2} />
        </View>
        <View style={styles.discLabel}>
          <Text variant="micro" weight="semibold" tone="danger" style={{ fontSize: 11, lineHeight: 14 }} maxFontSizeMultiplier={1.3}>
            Sécurité
          </Text>
        </View>
      </PressableScale>
      <SafetySheet visible={open} onClose={() => setOpen(false)} {...props} />
    </View>
  );
}

/**
 * @deprecated Use `SafetyDisc`, pinned outside the scroll view (X-02). Kept so screens that place
 * the safety entry in their own layout compile until they move to the disc. Same sheet.
 */
export function SafetyButton(props: SafetyProps) {
  useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        label="Sécurité"
        icon={<Siren size={18} color={colors.danger} strokeWidth={2} />}
        variant="secondary"
        onPress={() => setOpen(true)}
        testID="sos"
      />
      <SafetySheet visible={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}

/* ───────────── Passenger wallet ───────────── */

const MIN_TOPUP = 1000;
const MAX_TOPUP = 10_000_000;
const TOPUP_PRESETS = [5000, 10_000, 20_000, 50_000];

const PROVIDER_ICONS: Record<DemoPaymentOption['kind'], LucideIcon> = {
  card: CreditCard,
  mobile: Smartphone,
  agency: Store,
};

/**
 * Passenger wallet as a money home (audit P-40): the balance is the hero, one « Recharger » opens
 * the amount sheet, and the activity is rows whose state is a trailing glyph (C17, R1). The
 * provider answers top-ups on its own; the screen follows a pending one.
 */
export function PassengerWalletScreen({
  accountId,
  cityId,
  onBack,
}: {
  accountId: string;
  cityId: string;
  onBack: () => void;
}) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ['naya', accountId, 'passenger-wallet'];
  const wallet = useQuery({
    queryKey,
    queryFn: api.prototype.wallet,
    // A pending top-up is answered by the provider within seconds: follow it.
    refetchInterval: (q) =>
      q.state.data?.entries.some((e) => e.amount > 0 && e.status === 'pending')
        ? 2000
        : false,
  });
  const catalog = useQuery({
    queryKey: ['naya', accountId, 'catalog'],
    queryFn: api.prototype.catalog,
  });
  const options = (catalog.data?.payments ?? []).filter(
    (p) => p.enabled && (!p.cityIds.length || p.cityIds.includes(cityId)),
  );
  const kindOf = (providerId: string | null) =>
    catalog.data?.payments.find((p) => p.id === providerId)?.kind;
  const [sheet, setSheet] = useState(false);
  const [amount, setAmount] = useState('100');
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = options.find((p) => p.id === provider) ?? options[0];
  const cents = parseMoneyInput(amount);
  const topup = useSingleFlight(
    (vars: { amount: number; providerId: string }, k) =>
      api.prototype.topup(vars.amount, vars.providerId, k),
    {
      onSuccess: (entry) => {
        haptic.success();
        setSheet(false);
        toast(
          kindOf(entry.providerId) === 'agency'
            ? `Recharge créée · référence ${entry.id} à présenter au guichet`
            : 'Recharge envoyée au prestataire',
          'info',
        );
        topup.reset();
        qc.invalidateQueries({ queryKey });
      },
      // No reset here: a retry of the same amount and provider after a network error or a
      // timeout keeps the same Idempotency-Key, so the wallet is never credited twice (UI-17).
      onError: (e) => {
        haptic.error();
        if (isUncertainFailure(e)) {
          // The provider may have the top-up already: show it if so, and say the same retry
          // is safe (same amount and provider, same Idempotency-Key).
          setError(
            `${errorMessage(e)} Réessayez avec le même montant et le même moyen : la recharge ne sera pas comptée deux fois.`,
          );
          qc.invalidateQueries({ queryKey });
        } else setError(errorMessage(e));
      },
    },
  );
  const submit = () => {
    if (cents === null)
      return setError('Saisissez un montant valide, par exemple 100.');
    if (cents < MIN_TOPUP)
      return setError(`Minimum ${formatMoney(MIN_TOPUP)} par recharge.`);
    if (cents > MAX_TOPUP)
      return setError(`Maximum ${formatMoney(MAX_TOPUP)} par recharge.`);
    if (!chosen) return setError('Choisissez un moyen de recharge.');
    setError(null);
    topup.run({ amount: cents, providerId: chosen.id });
  };
  // Announce the provider's answer once, when a top-up leaves « en cours ».
  const seen = useRef(new Map<string, PassengerWalletEntry['status']>());
  useEffect(() => {
    for (const e of wallet.data?.entries ?? []) {
      const before = seen.current.get(e.id);
      if (before === 'pending' && e.amount > 0 && e.status !== 'pending') {
        if (e.status === 'confirmed') {
          haptic.success();
          toast(
            `${formatMoney(e.amount)} ajoutés à votre portefeuille`,
            'success',
          );
        } else {
          haptic.error();
          toast('Recharge refusée par le prestataire', 'danger');
        }
      }
      seen.current.set(e.id, e.status);
    }
  }, [wallet.data]);
  const entries = wallet.data?.entries.slice().reverse() ?? [];
  const available = (wallet.data?.balance ?? 0) - (wallet.data?.reserved ?? 0);
  const reserved = wallet.data?.reserved ?? 0;
  return (
    <Screen header={<Header title="Portefeuille Naya" onBack={onBack} />} testID="passenger-wallet">
      <View style={{ gap: 16 }}>
        {wallet.isError ? (
          <ErrorState onRetry={() => wallet.refetch()} />
        ) : null}
        {/* Principle 11: the number is the hero, tabular, never truncated. */}
        <View style={styles.balance} testID="wallet-balance" accessible accessibilityLabel={wallet.data ? `Solde disponible ${formatMoney(available)}${reserved > 0 ? `, dont ${formatMoney(reserved)} réservés pour vos courses` : ''}` : 'Solde en cours de chargement'}>
          {/* Ink, not muted: muted on the `selected` fill is 4.2:1 in light mode (WCAG needs 4.5 for a caption). */}
          <Text variant="caption" tone="ink">
            Solde disponible
          </Text>
          {wallet.data ? (
            <Text variant="display" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatMoney(available)}
            </Text>
          ) : (
            <Skeleton width="60%" height={44} radius={12} style={{ marginVertical: 4 }} />
          )}
          {reserved > 0 ? (
            <Text variant="caption" tone="ink" numeric>
              {formatMoney(reserved)} réservés pour vos courses
            </Text>
          ) : null}
          <Button
            label="Recharger"
            size="standard"
            full
            style={{ marginTop: 12 }}
            disabled={!wallet.data}
            onPress={() => {
              setError(null);
              setSheet(true);
            }}
            testID="wallet-recharge"
          />
        </View>
        <Section title="Activité" style={{ marginTop: 8 }}>
          {wallet.data && entries.length === 0 ? (
            <Text variant="caption" tone="muted">
              Aucune opération pour le moment.
            </Text>
          ) : null}
          {!wallet.data && !wallet.isError ? <Skeleton height={56} radius={12} /> : null}
          <View>
            {entries.map((e) => (
              <WalletEntryRow key={`${e.id}-${e.status}`} entry={e} kind={kindOf(e.providerId)} />
            ))}
          </View>
        </Section>
      </View>
      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        dismissible={!topup.isPending}
        title="Recharger"
        subtitle={
          chosen?.kind === 'agency'
            ? `Réglez en espèces au guichet ${chosen.name} avec la référence de la recharge. Le solde est crédité dès que l’agence confirme.`
            : 'Le solde est crédité dès la confirmation du prestataire, en quelques secondes.'
        }
        footer={
          <Button
            label={
              cents !== null && cents >= MIN_TOPUP
                ? `Recharger ${formatMoney(cents)}`
                : 'Recharger'
            }
            full
            loading={topup.isPending}
            disabled={!chosen}
            disabledReason={!chosen ? 'Aucun moyen de recharge n’est disponible dans votre ville.' : undefined}
            onPress={submit}
            testID="wallet-topup"
          />
        }
        testID="wallet-topup-sheet"
      >
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityLabel="Montants proposés">
            {TOPUP_PRESETS.map((v) => (
              <Pill
                key={v}
                label={formatMoney(v)}
                selected={cents === v}
                onPress={() => {
                  setAmount(String(v / 100));
                  setError(null);
                }}
                testID={`wallet-preset-${v / 100}`}
              />
            ))}
          </View>
          <FormField
            label="Montant (MAD)"
            value={amount}
            onChangeText={(t) => {
              setAmount(t);
              setError(null);
            }}
            keyboardType="decimal-pad"
            error={error}
            testID="wallet-amount"
          />
          <ListGroup label="Moyen de recharge">
            {options.map((p) => (
              <ListRow
                key={p.id}
                title={p.name}
                leading={<Icon icon={PROVIDER_ICONS[p.kind]} size={24} />}
                selected={chosen?.id === p.id}
                onPress={() => {
                  setProvider(p.id);
                  setError(null);
                }}
                testID={`wallet-provider-${p.id}`}
              />
            ))}
          </ListGroup>
        </View>
      </Sheet>
    </Screen>
  );
}

/**
 * One wallet movement (C17): the leading glyph is the direction and what was paid (`ArrowDownLeft`
 * for money in, `Car` or `Droplets` for money out), the amount carries the sign, and the state is
 * the trailing glyph (its word shows only for a refused top-up). Read as one sentence.
 */
function WalletEntryRow({ entry: e, kind }: { entry: PassengerWalletEntry; kind?: DemoPaymentOption['kind'] }) {
  useTheme();
  const credit = e.amount > 0;
  const status = walletEntryStatus(e, kind === 'agency');
  const Direction = credit ? ArrowDownLeft : e.rideId ? Car : Droplets;
  const agencyRef = credit && e.status === 'pending' && kind === 'agency';
  // R11: a released hold must not read as a payment, so its sentence stays visible and the amount is struck.
  const released = !credit && e.status === 'failed';
  const sub = agencyRef ? `Référence ${e.id} à présenter au guichet` : released ? `${formatShort(e.at)} · ${statusA11y('walletDebit', 'failed')}` : formatShort(e.at);
  const stateLabel = released ? null : status.kind === 'walletDebit' ? statusA11y('walletDebit', status.state) : statusA11y('walletCredit', status.state);
  return (
    <View
      style={styles.entry}
      accessible
      accessibilityLabel={[e.label, formatMoney(e.amount, { sign: 'always' }).replace('−', 'moins '), stateLabel, sub].filter(Boolean).join(', ')}
      testID={`wallet-entry-${e.id}`}
    >
      <IconDisc tone={credit ? 'success' : 'plain'}>
        <Icon icon={Direction} size={20} scale={false} color={credit ? colors.success : colors.accent} />
      </IconDisc>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={2}>
          {e.label}
        </Text>
        <Text variant="caption" tone={agencyRef ? 'accent' : 'muted'} numeric>
          {sub}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Money amount={e.amount} sign="always" tone={credit && e.status === 'confirmed' ? 'success' : released ? 'muted' : 'ink'} style={released ? { textDecorationLine: 'line-through' } : undefined} />
        {status.kind === 'walletDebit' ? (
          <StatusIcon kind="walletDebit" state={status.state} accessible={false} testID={`wallet-entry-${e.id}-status`} />
        ) : (
          <StatusIcon kind="walletCredit" state={status.state} accessible={false} testID={`wallet-entry-${e.id}-status`} />
        )}
      </View>
    </View>
  );
}
