import { Attachment } from './Attachment';
import { useTheme } from './../core/theme';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Linking, Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownLeft, ArrowUpRight, Banknote, Bell, Check, ChevronLeft, ChevronRight, CreditCard, Eye, EyeOff, Lock, Plus, Sparkles, Wallet } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { errorMessage, qk } from '@naya/api';
import {
  FAMILY_STATUS_LABELS,
  FAMILY_TRIP_KINDS,
  PLACES,
  RECIPIENT_RELATIONSHIPS,
  SAFETY_ACTION_LABELS,
  SAFETY_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type SafetyActionCode,
  type AuthorizedRecipient,
  type FamilyTripKind,
  type Place,
  formatMoney,
  formatShort,
  casablancaLocalToUtc,
  toCasablancaParts,
  type FamilyChild,
  type FamilyTrip,
  type LatLng,
  type SafetyAlert,
} from '@naya/domain';
import { colors, getColorScheme, gutter, radius, shadow } from '@naya/tokens';
import { Screen, Section } from '../Screen';
import { Header, headerButtonStyle } from '../Header';
import { Text } from '../Text';
import { Button } from '../Button';
import { FormField, Pill } from '../Form';
import { StatusBanner, ErrorState } from '../Feedback';
import { Card, IconDisc, ListGroup, ListRow } from '../List';
import { PressableScale } from '../PressableScale';
import { Sheet } from '../BottomSheet';
import { toast } from '../Toast';
import { NayaMap } from '../map';
import { pickFile, uploadFile } from './uploads';
import { haptic } from '../haptics';
import { PaymentInstructionsCard, ProviderIcon, providerSubtitle, sandboxLabel } from './payments';

export const demoKey = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const key = demoKey;
const panel = new Proxy(
  { backgroundColor: colors.surface, borderRadius: 22, padding: 18, gap: 12 },
  {
    get: (_, key) =>
      (
        ({
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 18,
          gap: 12,
        }) as Record<string, unknown>
      )[String(key)],
  },
);
const HOLD_MS = 1000;

/**
 * SOS during a ride. A 1-second hold (with visible progress) then a confirmation
 * prevents accidental alerts. Calls, sharing and SMS use the phone itself; the
 * alert, its position and every action are recorded for the Naya safety team.
 */
export function SafetyButton({
  rideId = null,
  familyTripId = null,
  location,
}: {
  rideId?: string | null;
  familyTripId?: string | null;
  location: LatLng;
}) {
  useTheme();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState<SafetyAlert | null>(null);
  const [note, setNote] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  // The incident status changes when the safety team takes it.
  const live = useQuery({
    queryKey: ['naya', 'sos', alert?.id],
    queryFn: api.prototype.alerts,
    enabled: !!alert,
    refetchInterval: 5000,
    select: (all) => all.find((x) => x.id === alert?.id) ?? null,
  });
  const current = live.data ?? alert;
  const hold = (on: boolean) =>
    Animated.timing(progress, { toValue: on ? 1 : 0, duration: on ? HOLD_MS : 150, useNativeDriver: false }).start();
  const mapsUrl = `https://maps.google.com/?q=${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
  const message = `Alerte Naya : j’ai besoin d’aide pendant mon trajet. Ma position : ${mapsUrl}`;
  const record = async (action: SafetyActionCode) => {
    if (!current) return;
    try {
      setAlert(await api.prototype.safetyAction(current.id, action));
    } catch (e) {
      toast(errorMessage(e), 'danger');
    }
  };
  const raise = async () => {
    setBusy(true);
    try {
      setAlert(
        await api.prototype.sos(
          { rideId, familyTripId, location, contactName: contact.trim() || 'Contact de confiance', contactPhone: phone.trim() || null, note: note.trim() || null },
          key(),
        ),
      );
      haptic.error();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const call = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => toast(`Composez le ${number}`, 'danger'));
    record('emergency_call');
  };
  const done = (code: SafetyActionCode) => current?.actions.some((a) => a.label.startsWith(SAFETY_ACTION_LABELS[code]));
  return (
    <>
      <Pressable
        onPressIn={() => hold(true)}
        onPressOut={() => hold(false)}
        onLongPress={() => {
          hold(false);
          haptic.warning();
          setOpen(true);
        }}
        delayLongPress={HOLD_MS}
        onPress={() => toast('Maintenez le bouton SOS 1 seconde pour déclencher une alerte.')}
        accessibilityRole="button"
        accessibilityLabel="SOS urgence"
        accessibilityHint="Maintenir appuyé une seconde pour ouvrir les options d’urgence"
        testID="sos"
        style={{ height: 48, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerSoft, justifyContent: 'center' }}
      >
        <Animated.View
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.danger, opacity: 0.25,
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
        <Text variant="label" weight="semibold" align="center" style={{ color: colors.danger }}>
          SOS · maintenir pour alerter
        </Text>
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={current ? `Alerte ${current.id}` : 'Déclencher une alerte ?'}
        subtitle={current ? SAFETY_STATUS_LABELS[current.status] : 'Naya reçoit votre position et les détails du trajet.'}
        testID="sos-sheet"
      >
        <View style={{ gap: 12 }}>
          {!current ? (
            <>
              <Text variant="caption" tone="muted" numeric>
                Position actuelle : {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </Text>
              <FormField label="Que se passe-t-il ? (facultatif)" value={note} onChangeText={setNote} multiline />
              <Button label="Confirmer l’alerte" variant="danger" loading={busy} onPress={raise} testID="confirm-sos" />
              <Button label="Annuler" variant="ghost" onPress={() => setOpen(false)} />
            </>
          ) : (
            <>
              <StatusBanner
                tone={current.status === 'resolved' ? 'success' : 'warning'}
                title={`Alerte ${current.id} enregistrée`}
                message={`${SAFETY_STATUS_LABELS[current.status]} · position et trajet transmis à l’équipe sécurité.`}
              />
              <Button label="Appeler la police · 19" variant="danger" onPress={() => call('19')} testID="sos-call-19" />
              <Button label="Ambulance et pompiers · 15" variant="secondary" onPress={() => call('15')} testID="sos-call-15" />
              <Button
                label={done('share_location') ? 'Position partagée ✓' : 'Partager ma position'}
                variant="secondary"
                testID="sos-share"
                onPress={async () => {
                  try {
                    const r = await Share.share({ message });
                    if (r.action !== Share.dismissedAction) record('share_location');
                  } catch (e) {
                    toast(errorMessage(e), 'danger');
                  }
                }}
              />
              <Text variant="label">Contact de confiance</Text>
              <FormField label="Nom" value={contact} onChangeText={setContact} testID="sos-contact-name" />
              <FormField label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="sos-contact-phone" />
              <Button
                label={done('trusted_contact') ? 'Contact alerté ✓' : 'Alerter par SMS'}
                variant="secondary"
                disabled={!phone.trim()}
                disabledReason="Saisissez le numéro du contact."
                testID="sos-contact"
                onPress={() => {
                  const sep = Platform.OS === 'ios' ? '&' : '?';
                  Linking.openURL(`sms:${phone.trim()}${sep}body=${encodeURIComponent(message)}`).catch(() => toast('SMS indisponible sur cet appareil', 'danger'));
                  record('trusted_contact');
                }}
              />
              <Button
                label={current.ticketId ? `Support contacté · ${current.ticketId}` : 'Contacter le support Naya'}
                variant="secondary"
                disabled={!!current.ticketId}
                testID="sos-support"
                onPress={() => record('support')}
              />
              <Text variant="label">Journal</Text>
              {current.actions.map((a, i) => (
                <Text key={i} variant="caption" numeric>
                  {formatShort(a.at)} · {a.label}
                </Text>
              ))}
            </>
          )}
        </View>
      </Sheet>
    </>
  );
}

export function PassengerWalletScreen({
  accountId,
  cityId,
  onBack,
  bottomSpace,
  onManagePayments,
}: {
  accountId: string;
  cityId: string;
  /** Opens the payment methods screen (Gérer, or a tap on a method). */
  onManagePayments?: () => void;
  /** Omitted when the wallet is a tab: no back button. */
  onBack?: () => void;
  /** Extra bottom padding so content clears a floating tab bar. */
  bottomSpace?: number;
}) {
  useTheme();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ['naya', accountId, 'passenger-wallet'];
  const wallet = useQuery({ queryKey, queryFn: api.prototype.wallet });
  // Same cache key as the Moyens de paiement screen, so a change there shows here at once.
  const methods = useQuery({ queryKey: qk.paymentMethods(accountId), queryFn: api.paymentMethods.list });
  const providers = useQuery({
    queryKey: ['naya', accountId, 'recharge-providers', cityId],
    queryFn: api.prototype.rechargeProviders,
  });
  const [topupSheetOpen, setTopupSheetOpen] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [amount, setAmount] = useState('100');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = providers.data?.find((p) => p.id === providerId) ?? providers.data?.[0];

  const availableBalance = (wallet.data?.balance ?? 0) - (wallet.data?.reserved ?? 0);
  const parsedAmount = Math.max(0, Math.round(Number(amount.replace(',', '.')) * 100));
  const isDark = getColorScheme() === 'dark';

  const run = async (id?: string, outcome?: 'confirmed' | 'failed') => {
    setBusy(true);
    try {
      if (id && outcome) {
        await api.prototype.resolveTopup(id, outcome);
        toast(outcome === 'confirmed' ? 'Recharge confirmée ✓' : 'Recharge annulée', outcome === 'confirmed' ? 'success' : 'default');
      } else {
        if (!chosen) throw new Error('Choisissez un moyen de recharge.');
        const num = Number(amount.replace(',', '.'));
        if (isNaN(num) || num <= 0) throw new Error('Indiquez un montant supérieur à 0 MAD.');
        if (chosen.needsPhone && !phone.trim()) throw new Error('Indiquez le numéro associé à votre wallet.');
        await api.prototype.topup(
          Math.round(num * 100),
          chosen.id,
          key(),
          chosen.needsPhone ? phone.trim() : undefined,
        );
        toast(`Demande de recharge de ${num} MAD initiée`, 'success');
        setTopupSheetOpen(false);
      }
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const sectionTitle = { fontSize: 18, lineHeight: 24, letterSpacing: -0.3 } as const;
  const onPlum = 'rgba(255,255,255,0.92)';
  const chevron = isDark ? colors.muted : '#A8A0A6';
  const roundButton = headerButtonStyle();

  const walletHeader = (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: gutter, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {onBack ? (
        <PressableScale onPress={() => { haptic.select(); onBack(); }} accessibilityRole="button" accessibilityLabel="Retour" testID="header-back" style={roundButton}>
          <ChevronLeft size={28} color={colors.accent} strokeWidth={2.4} />
        </PressableScale>
      ) : null}
      <Text weight="bold" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontSize: 32, lineHeight: 40, letterSpacing: -0.9 }}>
        Portefeuille
      </Text>
      <PressableScale onPress={() => { haptic.tap(); toast('Aucune nouvelle notification'); }} accessibilityRole="button" accessibilityLabel="Notifications" style={[roundButton, { marginLeft: 0, marginRight: -10 }]}>
        <Bell size={20} color={colors.ink} strokeWidth={1.9} />
      </PressableScale>
    </View>
  );

  return (
    <Screen
      keyboard
      testID="passenger-wallet"
      header={walletHeader}
      contentStyle={bottomSpace ? { paddingBottom: bottomSpace + 16 } : undefined}
    >
      <View style={{ gap: 28 }}>
        {wallet.isError ? (
          <ErrorState onRetry={() => wallet.refetch()} />
        ) : null}

        {/* ── Plum balance card ── */}
        <View style={{ borderRadius: 26, backgroundColor: '#5A2A47', shadowColor: '#3F1B34', shadowOpacity: isDark ? 0 : 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
          <View style={{ borderRadius: 26, overflow: 'hidden', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 22 }}>
            <LinearGradient
              colors={isDark ? ['#2E1426', '#552A47'] : ['#47203A', '#7C3F5F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <PressableScale
              onPress={() => { haptic.select(); setBalanceVisible((v) => !v); }}
              accessibilityRole="button"
              accessibilityLabel={balanceVisible ? 'Masquer le solde' : 'Afficher le solde'}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}
            >
              <Text weight="medium" style={{ fontSize: 15, lineHeight: 20, color: onPlum }}>Solde Naya</Text>
              {balanceVisible ? <Eye size={17} color={onPlum} strokeWidth={1.9} /> : <EyeOff size={17} color={onPlum} strokeWidth={1.9} />}
            </PressableScale>

            <Text
              testID="wallet-balance-row"
              weight="bold"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ marginTop: 8, fontSize: 40, lineHeight: 48, letterSpacing: -1.2, color: '#FFFFFF' }}
            >
              {balanceVisible ? `${(availableBalance / 100).toFixed(2).replace('.', ',')} MAD` : '•••••• MAD'}
            </Text>

            <PressableScale
              onPress={() => { haptic.tap(); setTopupSheetOpen(true); }}
              testID="wallet-open-topup"
              accessibilityRole="button"
              accessibilityLabel="Ajouter de l'argent"
              style={{ marginTop: 16, height: 36, paddingLeft: 16, paddingRight: 20, borderRadius: radius.pill, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}
            >
              <Plus size={17} color="#5A2A47" strokeWidth={2.3} />
              <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20, color: '#5A2A47' }}>Ajouter de l'argent</Text>
            </PressableScale>

            <View style={{ marginTop: 11, height: 26, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}>
              <Lock size={12} color={onPlum} strokeWidth={2.1} />
              <Text weight="medium" style={{ fontSize: 12.5, lineHeight: 16, color: onPlum }}>Paiements 100% sécurisés</Text>
            </View>
          </View>
        </View>

        {/* ── Payment methods (same data as the Moyens de paiement screen) ── */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }}>
            <Text weight="semibold" accessibilityRole="header" style={sectionTitle}>Moyens de paiement</Text>
            {onManagePayments ? (
              <PressableScale onPress={() => { haptic.select(); onManagePayments(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Gérer les moyens de paiement" testID="wallet-manage-payments">
                <Text weight="semibold" tone="accent" style={{ fontSize: 15, lineHeight: 20 }}>Gérer</Text>
              </PressableScale>
            ) : null}
          </View>

          <View style={{ gap: 12 }}>
            {(methods.data ?? []).map((m) => {
              const brand = m.kind === 'card' ? (/visa/i.test(m.label) ? 'VISA' : /master/i.test(m.label) ? 'MC' : null) : null;
              const icon =
                m.kind === 'cash' ? <Banknote size={22} color={isDark ? colors.success : '#4F7D62'} strokeWidth={1.8} />
                : m.kind === 'card' ? (brand ? <Text weight="bold" style={{ fontSize: brand === 'VISA' ? 15 : 16, lineHeight: 20, letterSpacing: 0.2, color: isDark ? colors.info : '#1F3B7A' }}>{brand}</Text> : <CreditCard size={21} color={isDark ? colors.info : '#1F3B7A'} strokeWidth={1.8} />)
                : <Wallet size={21} color={colors.accent} strokeWidth={1.8} />;
              const tile = m.kind === 'cash' ? (isDark ? colors.successSoft : '#E7F0EA') : m.kind === 'card' ? (isDark ? colors.infoSoft : '#EAF0FB') : isDark ? colors.mauveSoft : '#F3E7ED';
              const subtitle = !m.availableInCity ? 'Indisponible dans votre ville' : m.kind === 'card' ? `Expire ${String(m.expMonth).padStart(2, '0')}/${String(m.expYear).slice(-2)}` : m.kind === 'cash' ? 'Payer à la fin du trajet' : m.kind === 'wallet' ? 'Débité de votre solde Naya' : 'Payez depuis votre wallet';
              return (
                <PaymentMethodRow
                  key={m.id}
                  icon={icon}
                  tile={tile}
                  title={m.kind === 'card' && m.last4 ? <MaskedCardNumber last4={m.last4} /> : m.label}
                  accessibilityTitle={m.kind === 'card' ? `Carte bancaire ${m.last4}` : m.label}
                  subtitle={subtitle}
                  badge={m.isDefault ? <Text weight="semibold" style={{ fontSize: 13, lineHeight: 18, color: isDark ? colors.warning : '#8A6421' }}>Préféré</Text> : undefined}
                  chevron={chevron}
                  onPress={() => { haptic.select(); onManagePayments?.(); }}
                />
              );
            })}
            {methods.isError ? <ErrorState onRetry={() => methods.refetch()} /> : null}
          </View>
        </View>

        {/* ── Transactions Section ── */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }}>
            <Text weight="semibold" accessibilityRole="header" style={sectionTitle}>Transactions récentes</Text>
            {wallet.data?.entries && wallet.data.entries.length > 0 ? (
              <Text weight="semibold" tone="accent" style={{ fontSize: 15, lineHeight: 20 }}>Voir tout</Text>
            ) : null}
          </View>

          {wallet.data?.entries && wallet.data.entries.length > 0 ? (
            <View style={{ gap: 10 }}>
              {wallet.data.entries
                .slice()
                .reverse()
                .map((e) => {
                  const isPositive = e.amount > 0;
                  return (
                    <Card key={`${e.id}-${e.status}`} style={{ paddingVertical: 12, paddingLeft: 14, paddingRight: 16, borderRadius: 20, gap: 12, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 }}>
                        <View style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isPositive ? (isDark ? colors.successSoft : '#E7F0EA') : (isDark ? colors.mauveSoft : '#F3E7ED') }}>
                          {isPositive ? (
                            <ArrowDownLeft size={20} color={isDark ? colors.success : '#4F7D62'} strokeWidth={2} />
                          ) : (
                            <ArrowUpRight size={20} color={colors.accent} strokeWidth={2} />
                          )}
                        </View>
                        <View style={{ flex: 1, gap: 1 }}>
                          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 22 }}>
                            {e.label}
                          </Text>
                          <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
                            {formatShort(e.at)} ·{' '}
                            <Text
                              weight="medium"
                              tone={e.status === 'confirmed' ? 'success' : e.status === 'pending' ? 'warning' : 'danger'}
                              style={{ fontSize: 13, lineHeight: 18 }}
                            >
                              {e.status === 'confirmed'
                                ? 'Confirmée'
                                : e.status === 'pending'
                                  ? 'En attente'
                                  : 'Refusée / libérée'}
                            </Text>
                          </Text>
                        </View>
                        <Text
                          weight="semibold"
                          numeric
                          style={{ fontSize: 16, lineHeight: 22, color: isPositive ? (isDark ? colors.success : '#3F7A57') : colors.ink }}
                        >
                          {isPositive ? '+' : ''}{formatMoney(e.amount)}
                        </Text>
                      </View>

                      {e.amount > 0 ? <PaymentInstructionsCard op={e} /> : null}

                      {e.status === 'failed' && e.failureReason ? (
                        <Text variant="caption" tone="danger">{e.failureReason}</Text>
                      ) : null}

                      {e.amount > 0 && e.status === 'pending' ? (
                        <View style={{ gap: 8, backgroundColor: colors.background, padding: 12, borderRadius: 14 }}>
                          <Text variant="micro" tone="muted">{sandboxLabel(e.flow)} :</Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Button
                              label="Simuler la confirmation"
                              loading={busy}
                              onPress={() => run(e.id, 'confirmed')}
                              style={{ flex: 1 }}
                            />
                            <Button
                              label="Simuler le refus"
                              variant="secondary"
                              loading={busy}
                              onPress={() => run(e.id, 'failed')}
                              style={{ flex: 1 }}
                            />
                          </View>
                        </View>
                      ) : null}
                    </Card>
                  );
                })}
            </View>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 10, borderRadius: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={28} color={colors.accent} />
              </View>
              <Text variant="label" weight="semibold">
                Aucune transaction récente
              </Text>
              <Text variant="caption" tone="muted" align="center" style={{ maxWidth: 260 }}>
                Vos recharges et paiements de courses apparaîtront ici dès vos premières opérations.
              </Text>
            </Card>
          )}
        </View>
      </View>

      {/* ── Recharge Modal Bottom Sheet (Clean BottomSheet matching design) ── */}
      <Sheet
        visible={topupSheetOpen}
        onClose={() => setTopupSheetOpen(false)}
        title="Recharger"
        subtitle="Créditer votre compte portefeuille"
        testID="topup-sheet"
        scrollable
        footer={
          <Button
            label={chosen && Number(amount.replace(',', '.')) > 0 ? `Recharger ${amount} MAD` : 'Recharger'}
            loading={busy}
            disabled={!chosen || !amount || Number(amount.replace(',', '.')) <= 0}
            onPress={() => run()}
            testID="wallet-topup"
          />
        }
      >
        <View style={{ gap: 18, paddingBottom: 16 }}>
          {/* Amount input card with Moroccan MAD indicator */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderWidth: 1.5,
              borderColor: colors.line,
              padding: 16,
              gap: 12,
              ...shadow.card,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14, borderRightWidth: 1, borderRightColor: colors.line }}>
                <Text style={{ fontSize: 24 }}>🇲🇦</Text>
                <Text variant="heading" weight="semibold" tone="accent">MAD</Text>
              </View>
              <TextInput
                value={amount}
                onChangeText={(val) => setAmount(val.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                style={{
                  flex: 1,
                  fontSize: 30,
                  fontFamily: 'Inter_700Bold',
                  color: colors.ink,
                  textAlign: 'right',
                  paddingVertical: 2,
                  paddingHorizontal: 8,
                }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                testID="topup-amount-input"
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.line, opacity: 0.6 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="caption" tone="muted">
                Solde actuel : {formatMoney(availableBalance)}
              </Text>
              {Number(amount.replace(',', '.')) > 0 ? (
                <Text variant="caption" tone="accent" weight="semibold">
                  + {formatMoney(parsedAmount)}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Quick preset amount chips */}
          <View style={{ gap: 8 }}>
            <Text variant="caption" tone="muted" weight="medium">Montants rapides</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['50', '100', '200', '500'].map((preset) => {
                const isSelected = amount === preset;
                return (
                  <PressableScale
                    key={preset}
                    onPress={() => {
                      haptic.select();
                      setAmount(preset);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: radius.pill,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.accent : colors.line,
                      backgroundColor: isSelected ? colors.selected : colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      variant="caption"
                      weight={isSelected ? 'bold' : 'medium'}
                      style={{ color: isSelected ? colors.accent : colors.ink }}
                    >
                      {preset} MAD
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Payment providers selection list */}
          <View style={{ gap: 10 }}>
            <Text variant="label" weight="semibold">Moyen de recharge</Text>
            {providers.data && !providers.data.length ? (
              <StatusBanner compact tone="warning" title="Aucun moyen de recharge" message="aucun prestataire n’est activé dans votre ville" />
            ) : null}
            <View accessibilityRole="radiogroup" accessibilityLabel="Moyen de recharge" style={{ gap: 8 }}>
              {(providers.data ?? []).map((p) => {
                const isChosen = chosen?.id === p.id;
                return (
                  <PressableScale
                    key={p.id}
                    testID={`topup-provider-${p.kind}`}
                    onPress={() => {
                      haptic.select();
                      setProviderId(p.id);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isChosen }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: radius.card,
                      borderWidth: 1.5,
                      borderColor: isChosen ? colors.accent : colors.line,
                      backgroundColor: isChosen ? colors.selected : colors.surface,
                    }}
                  >
                    <ProviderIcon kind={p.kind} size={40} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="label" weight="semibold">
                        {p.name}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={2}>
                        {providerSubtitle(p)}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: isChosen ? 0 : 2,
                        borderColor: colors.line,
                        backgroundColor: isChosen ? colors.accent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isChosen ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Phone field if required */}
          {chosen?.needsPhone ? (
            <FormField
              label="Numéro associé à votre wallet"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="06 12 34 56 78"
              testID="topup-phone"
            />
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}

/** One saved payment method on the wallet screen: tinted tile, two lines, optional badge, chevron. */
function PaymentMethodRow({ icon, tile, title, accessibilityTitle, subtitle, badge, chevron, onPress }: { icon: ReactNode; tile: string; title: ReactNode; accessibilityTitle?: string; subtitle: string; badge?: ReactNode; chevron: string; onPress: () => void }) {
  useTheme();
  const label = [accessibilityTitle ?? (typeof title === 'string' ? title : ''), subtitle].filter(Boolean).join(', ');
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minHeight: 72, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, borderRadius: 20, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}
    >
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, gap: 1 }}>
        {typeof title === 'string' ? <Text weight="semibold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 22 }}>{title}</Text> : title}
        <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{subtitle}</Text>
      </View>
      {badge}
      <ChevronRight size={18} color={chevron} strokeWidth={2} style={{ marginLeft: badge ? 6 : 0 }} />
    </PressableScale>
  );
}

/** "●●●● ●●●● ●●●● 4242" with real round dots, so the mask reads the same on every font. */
function MaskedCardNumber({ last4 }: { last4: string }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 22, gap: 7 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((g) => (
        <View key={g} style={{ flexDirection: 'row', gap: 2.5 }}>
          {[0, 1, 2, 3].map((d) => <View key={d} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink }} />)}
        </View>
      ))}
      <Text weight="semibold" numeric style={{ fontSize: 16, lineHeight: 22, letterSpacing: 0.3 }}>{last4}</Text>
    </View>
  );
}

/** Addresses offered for child trips: places of the parent's city from the API (any city added in the back-office). */
export type CityPlaces = { home: Place; list: Place[]; school: Place; activity: Place };
export function cityPlaces(found?: Place[]): CityPlaces {
  const base = found?.length ? found : [PLACES.hayRiad, PLACES.agdal, PLACES.souissi, PLACES.ocean, PLACES.centreVille, PLACES.medina];
  const homeSrc = base.find((p) => p.id === PLACES.hayRiad.id) ?? base[0]!;
  const list = base.filter((p) => p !== homeSrc).slice(0, 6);
  return {
    home: { ...homeSrc, label: 'Maison' },
    list,
    school: list.find((p) => p.id === PLACES.agdal.id) ?? list[0] ?? homeSrc,
    activity: list.find((p) => p.id === PLACES.souissi.id) ?? list[1] ?? list[0] ?? homeSrc,
  };
}
export const schoolOf = (c: FamilyChild | undefined, places: CityPlaces) =>
  c?.schoolPlace ? { ...c.schoolPlace, label: c.school } : { ...places.school, label: c?.school || 'École' };
const STEP_TIMES: [keyof NonNullable<FamilyTrip['times']>, string][] = [
  ['en_route', 'Départ de la chauffeuse'],
  ['arrived', 'Arrivée au point de récupération'],
  ['picked_up', 'Récupération de l’enfant'],
  ['in_progress', 'Début du trajet'],
  ['completed', 'Arrivée et remise'],
];

export function FamilyScreen({
  accountId,
  role,
  onBack,
  onNotify,
  cityId,
}: {
  accountId: string;
  role: 'passenger' | 'driver';
  onBack: () => void;
  /** Parent's city: child trip addresses come from it. */
  cityId?: string;
  /** Called for each new trip notification, so the app can show a system notification. */
  onNotify?: (title: string) => void;
}) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ['naya', accountId, 'family'];
  const family = useQuery({
    queryKey,
    queryFn: api.prototype.family,
    refetchInterval: 4000,
  });
  const catalog = useQuery({
    queryKey: ['naya', accountId, 'catalog'],
    queryFn: api.prototype.catalog,
  });
  const placesQ = useQuery({
    queryKey: ['naya', accountId, 'family-places', cityId],
    queryFn: () => api.places.search('', cityId!),
    enabled: role === 'passenger' && !!cityId,
  });
  const places = cityPlaces(placesQ.data);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<FamilyChild | 'new' | null>(null);
  const [tripForm, setTripForm] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const data = family.data;
  // Notify the parent of every new step or alert (not the ones already there on open).
  const seen = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    if (!data || role !== 'passenger') return;
    const counts = Object.fromEntries(data.trips.map((t) => [t.id, t.notifications.length]));
    if (seen.current)
      for (const t of data.trips)
        for (const n of t.notifications.slice(seen.current[t.id] ?? t.notifications.length)) {
          toast(n.title);
          onNotify?.(n.title);
        }
    seen.current = counts;
  }, [data, role, onNotify]);
  return (
    <Screen
      keyboard
      header={
        <Header
          title={role === 'driver' ? 'Mes familles' : 'Naya Famille'}
          onBack={onBack}
        />
      }
    >
      <View style={{ gap: 18 }}>
        <StatusBanner
          tone="info"
          title="Un trajet en confiance"
          message={
            role === 'driver'
              ? 'Photo à l’arrivée, vérification de l’enfant, puis remise à une personne autorisée.'
              : 'Une chauffeuse dédiée, le suivi en direct et une remise uniquement aux personnes autorisées.'
          }
        />
        <Button
          label="Charger l’exemple de démo"
          variant="secondary"
          loading={busy}
          onPress={() => run(api.prototype.example)}
          testID="family-example"
        />
        {family.isError ? (
          <ErrorState onRetry={() => family.refetch()} />
        ) : null}
        {role === 'passenger' ? (
          <>
            {data?.subscription && data.subscription.status !== 'cancelled' ? (
              <View style={panel}>
                <Text variant="title">{data.subscription.planName}</Text>
                <Text>Chauffeuse dédiée · {data.subscription.driverName}</Text>
                <Text variant="caption" tone="muted">
                  {data.subscription.includedTrips} trajets · jusqu’au{' '}
                  {formatShort(data.subscription.endsAt)}
                </Text>
                {data.subscription.status !== 'active' ? (
                  <StatusBanner
                    compact
                    tone="warning"
                    title={`Abonnement ${SUBSCRIPTION_STATUS_LABELS[data.subscription.status].toLowerCase()}`}
                    message="aucun nouveau trajet ne peut être planifié · contactez le support Naya"
                  />
                ) : null}
              </View>
            ) : (
              <Section title="Choisir un abonnement">
                <View style={{ gap: 12 }}>
                  {catalog.data?.plans
                    .filter((p) => p.enabled)
                    .map((p) => (
                      <View key={p.id} style={panel}>
                        <Text variant="title">{p.name}</Text>
                        <Text>
                          {formatMoney(p.price)} / {p.durationDays} jours ·{' '}
                          {p.includedTrips} trajets
                        </Text>
                        {p.features.map((f) => (
                          <Text key={f} variant="caption" tone="muted">
                            • {f}
                          </Text>
                        ))}
                        <Button
                          label="Activer en démo"
                          loading={busy}
                          onPress={() =>
                            run(() => api.prototype.subscribe(p.id, key()))
                          }
                        />
                      </View>
                    ))}
                </View>
              </Section>
            )}
            <ListGroup label="Mes enfants">
              {data?.children.map((c) => (
                <ListRow
                  key={c.id}
                  testID={`child-${c.id}`}
                  title={`${c.firstName} · ${c.age} ans`}
                  subtitle={`${c.school} · ${c.recipients.map((r) => `${r.name} (${r.relationship})`).join(', ')}`}
                  onPress={() => setEditing(c)}
                />
              ))}
            </ListGroup>
            {editing ? (
              <ChildForm
                accountId={accountId}
                places={places}
                initial={editing === 'new' ? null : editing}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={(input) =>
                  run(async () => {
                    if (editing === 'new') await api.prototype.child(input);
                    else await api.prototype.updateChild(editing.id, input);
                    setEditing(null);
                  })
                }
              />
            ) : (
              <Button
                label="Ajouter un enfant"
                variant="secondary"
                onPress={() => setEditing('new')}
                testID="family-add-child"
              />
            )}
            {data?.subscription?.status === 'active' && data.children.length ? (
              <Button
                label="Planifier un trajet"
                onPress={() => setTripForm(!tripForm)}
                testID="family-plan-trip"
              />
            ) : null}
            {tripForm && data?.children.length ? (
              <TripForm
                children={data.children}
                places={places}
                busy={busy}
                onSave={(input) =>
                  run(async () => {
                    await api.prototype.trip(input, key());
                    setTripForm(false);
                  })
                }
              />
            ) : null}
          </>
        ) : null}
        <Section title="Trajets et suivi">
          <View style={{ gap: 16 }}>
            {data?.trips.map((t) => (
              <FamilyTripCard
                key={t.id}
                trip={t}
                child={data.children.find((c) => c.id === t.childId)}
                role={role}
                accountId={accountId}
                busy={busy}
                run={run}
              />
            ))}
            {!data?.trips.length ? (
              <Text tone="muted">Vos trajets familiaux apparaîtront ici.</Text>
            ) : null}
          </View>
        </Section>
      </View>
    </Screen>
  );
}

type ChildInput = Omit<FamilyChild, 'id' | 'passengerId'>;

function ChildForm({
  accountId,
  places,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  accountId: string;
  places: CityPlaces;
  initial: FamilyChild | null;
  busy: boolean;
  onSave: (input: ChildInput) => void;
  onCancel: () => void;
}) {
  useTheme();
  const api = useApi();
  const [name, setName] = useState(initial?.firstName ?? '');
  const [age, setAge] = useState(String(initial?.age ?? 8));
  const [photo, setPhoto] = useState<string | null>(initial?.photo ?? null);
  const [school, setSchool] = useState(initial?.school ?? '');
  const [schoolPlace, setSchoolPlace] = useState<Place>(
    initial?.schoolPlace ?? places.school,
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [recipients, setRecipients] = useState<AuthorizedRecipient[]>(
    initial?.recipients.length
      ? initial.recipients
      : [{ id: key(), name: '', relationship: 'Mère', phone: '', verificationCode: '' }],
  );
  const [uploading, setUploading] = useState(false);
  const patch = (i: number, change: Partial<AuthorizedRecipient>) =>
    setRecipients(recipients.map((r, j) => (j === i ? { ...r, ...change } : r)));
  const addPhoto = async (source: 'camera' | 'library') => {
    setUploading(true);
    try {
      const f = await pickFile(source);
      if (f === 'denied') toast('Autorisez l’accès aux photos dans les réglages.', 'danger');
      if (!f || f === 'denied') return;
      setPhoto((await uploadFile(api, f, 'support_attachment')).id);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setUploading(false);
    }
  };
  return (
    <View style={panel} testID="child-form">
      <Text variant="title">{initial ? `Modifier · ${initial.firstName}` : 'Nouvel enfant'}</Text>
      <FormField label="Prénom" value={name} onChangeText={setName} testID="child-name" />
      <FormField label="Âge" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} />
      <Text variant="label">Photo (facultative)</Text>
      <Text variant="caption" tone="muted">
        Montrée uniquement à la chauffeuse dédiée, pour vérifier l’enfant à la récupération.
      </Text>
      {photo ? <Attachment id={photo} accountId={accountId} label="Photo de l’enfant" /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pill label="Prendre une photo" onPress={() => addPhoto('camera')} disabled={uploading} />
        <Pill label="Choisir dans la galerie" onPress={() => addPhoto('library')} disabled={uploading} />
        {photo ? <Pill label="Retirer la photo" onPress={() => setPhoto(null)} /> : null}
      </View>
      <FormField label="École ou destination habituelle" value={school} onChangeText={setSchool} testID="child-school" />
      <Text variant="caption">Adresse (démo)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {places.list.map((p) => (
          <Pill key={p.id} label={p.label} selected={schoolPlace.id === p.id} onPress={() => setSchoolPlace(p)} />
        ))}
      </View>
      <FormField
        label="Informations importantes"
        placeholder="Allergies, santé, consignes de récupération…"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <Text variant="label">Personnes autorisées à récupérer l’enfant</Text>
      <Text variant="caption" tone="muted">
        Chaque personne a un code à 4 chiffres. La chauffeuse le saisit à la remise, sans jamais le voir.
      </Text>
      {recipients.map((r, i) => (
        <View key={r.id} style={{ gap: 8, borderTopWidth: i ? 1 : 0, borderColor: colors.line, paddingTop: i ? 12 : 0 }}>
          <FormField label="Nom" value={r.name} onChangeText={(v) => patch(i, { name: v })} testID={`recipient-name-${i}`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RECIPIENT_RELATIONSHIPS.map((rel) => (
              <Pill key={rel} label={rel} selected={r.relationship === rel} onPress={() => patch(i, { relationship: rel })} />
            ))}
          </View>
          <FormField label="Téléphone (facultatif)" value={r.phone ?? ''} onChangeText={(v) => patch(i, { phone: v })} keyboardType="phone-pad" />
          <FormField
            label="Code de remise (4 chiffres)"
            value={r.verificationCode}
            onChangeText={(v) => patch(i, { verificationCode: v.replace(/\D/g, '') })}
            keyboardType="number-pad"
            maxLength={4}
            testID={`recipient-code-${i}`}
          />
          {recipients.length > 1 ? (
            <Button label="Retirer cette personne" variant="ghost" onPress={() => setRecipients(recipients.filter((_, j) => j !== i))} />
          ) : null}
        </View>
      ))}
      {recipients.length < 8 ? (
        <Button
          label="Ajouter une personne autorisée"
          variant="secondary"
          onPress={() =>
            setRecipients([...recipients, { id: key(), name: '', relationship: 'Personne autorisée', phone: '', verificationCode: '' }])
          }
        />
      ) : null}
      <Button
        label="Enregistrer"
        loading={busy}
        disabled={uploading}
        testID="child-save"
        onPress={() =>
          onSave({
            firstName: name.trim(),
            age: Number(age),
            photo,
            school: school.trim(),
            schoolPlace: { ...schoolPlace, label: school.trim() || schoolPlace.label },
            notes: notes.trim(),
            recipients: recipients.map((r) => ({ ...r, name: r.name.trim(), phone: r.phone?.trim() || undefined })),
          })
        }
      />
      <Button label="Annuler" variant="ghost" onPress={onCancel} />
    </View>
  );
}

function TripForm({
  children,
  places: cp,
  busy,
  onSave,
}: {
  children: FamilyChild[];
  places: CityPlaces;
  busy: boolean;
  onSave: (input: {
    childId: string;
    pickup: Place;
    destination: Place;
    pickupAt: string;
    weekdays: number[];
    kind: FamilyTripKind;
  }) => void;
}) {
  useTheme();
  const [childId, setChildId] = useState(children[0]!.id);
  const child = children.find((c) => c.id === childId);
  const [kind, setKind] = useState<FamilyTripKind>('home_school');
  const HOME = cp.home;
  const [pickup, setPickup] = useState<Place>(HOME);
  const [destination, setDestination] = useState<Place>(schoolOf(child, cp));
  const [date, setDate] = useState(
    () => toCasablancaParts(new Date(Date.now() + 86400000).toISOString()).date,
  );
  const [pickupTime, setPickupTime] = useState('08:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const places = [HOME, schoolOf(child, cp), ...cp.list].filter(
    (p, i, all) => all.findIndex((x) => x.label === p.label) === i,
  );
  const preset = (k: FamilyTripKind, c = child) => {
    setKind(k);
    if (k === 'home_school') { setPickup(HOME); setDestination(schoolOf(c, cp)); setPickupTime('08:00'); }
    if (k === 'school_home') { setPickup(schoolOf(c, cp)); setDestination(HOME); setPickupTime('16:30'); }
    if (k === 'activity_home') { setPickup(cp.activity); setDestination(HOME); setPickupTime('18:00'); }
  };
  const pick = (value: Place, onPick: (p: Place) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {places.map((p) => (
        <Pill key={p.label} label={p.label} selected={value.label === p.label} onPress={() => { onPick(p); setKind('other'); }} />
      ))}
    </View>
  );
  return (
    <View style={panel} testID="trip-form">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {children.map((c) => (
          <Pill key={c.id} label={c.firstName} selected={childId === c.id} onPress={() => { setChildId(c.id); preset(kind, c); }} />
        ))}
      </View>
      <Text variant="caption">Type de trajet</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(FAMILY_TRIP_KINDS) as FamilyTripKind[]).map((k) => (
          <Pill key={k} label={FAMILY_TRIP_KINDS[k]} selected={kind === k} onPress={() => preset(k)} testID={`trip-kind-${k}`} />
        ))}
      </View>
      <Text variant="caption">Départ</Text>
      {pick(pickup, setPickup)}
      <Text variant="caption">Destination</Text>
      {pick(destination, setDestination)}
      <FormField label="Date du premier trajet (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
      <FormField label="Heure de récupération (HH:MM)" value={pickupTime} onChangeText={setPickupTime} />
      <Text variant="caption">Répéter chaque semaine</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, i) => (
          <Pill
            key={d}
            label={d}
            selected={days.includes(i)}
            onPress={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
          />
        ))}
      </View>
      <Text variant="caption" tone="muted">
        Adresses de démonstration à Rabat · le trajet suivant est créé après chaque remise.
      </Text>
      <Button
        label="Enregistrer le trajet"
        loading={busy}
        disabled={pickup.label === destination.label}
        disabledReason="Le départ et la destination doivent être différents."
        testID="trip-save"
        onPress={() =>
          onSave({
            childId,
            pickup,
            destination,
            pickupAt: casablancaLocalToUtc(date, pickupTime),
            weekdays: days,
            kind,
          })
        }
      />
    </View>
  );
}

const TRIP_STEPS: { status: FamilyTrip['status']; label: string }[] = [
  { status: 'scheduled', label: 'Planifié' },
  { status: 'en_route', label: 'En route' },
  { status: 'arrived', label: 'Arrivée' },
  { status: 'picked_up', label: 'Récupéré' },
  { status: 'in_progress', label: 'En trajet' },
  { status: 'completed', label: 'Remis' },
];

/** White section card used by the family screens (a function: colours follow the theme). */
export const familyCard = () => ({ backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 12, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;

export function FamilyStatusChip({ status }: { status: FamilyTrip['status'] }) {
  useTheme();
  const live = status === 'en_route' || status === 'in_progress';
  const tone = status === 'completed' ? { bg: colors.successSoft, fg: colors.success } : live ? { bg: colors.selected, fg: colors.accent } : status === 'scheduled' ? { bg: colors.background, fg: colors.muted } : { bg: colors.warningSoft, fg: colors.warning };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: tone.bg }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.fg }} />
      <Text weight="semibold" style={{ fontSize: 12, lineHeight: 16, color: tone.fg }} numberOfLines={1}>{FAMILY_STATUS_LABELS[status]}</Text>
    </View>
  );
}

/** Six steps of a child trip, the current one highlighted. One continuous track behind fixed-size dots. */
function TripStepper({ status }: { status: FamilyTrip['status'] }) {
  useTheme();
  const current = Math.max(0, TRIP_STEPS.findIndex((x) => x.status === status));
  const n = TRIP_STEPS.length;
  const DOT = 12;
  return (
    <View accessible accessibilityLabel={`Étape ${current + 1} sur ${n} : ${TRIP_STEPS[current]?.label}`}>
      <View style={{ height: 22, justifyContent: 'center' }}>
        {/* Track from the first to the last dot centre; the done part is filled. */}
        <View style={{ position: 'absolute', left: `${50 / n}%`, right: `${50 / n}%`, height: 3, borderRadius: 2, backgroundColor: colors.line }} />
        <View style={{ position: 'absolute', left: `${50 / n}%`, width: `${(100 / n) * current}%`, height: 3, borderRadius: 2, backgroundColor: colors.accent }} />
        <View style={{ flexDirection: 'row' }}>
          {TRIP_STEPS.map((x, i) => (
            <View key={x.status} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {i === current ? (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.accent }} />
                </View>
              ) : (
                <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: i < current ? colors.accent : colors.line }} />
              )}
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {TRIP_STEPS.map((x, i) => (
          <Text key={x.status} align="center" weight={i === current ? 'semibold' : 'regular'} tone={i === current ? 'accent' : 'muted'} numberOfLines={1} style={{ flex: 1, fontSize: 10.5, lineHeight: 14 }}>{x.label}</Text>
        ))}
      </View>
    </View>
  );
}

export function FamilyTripCard({
  trip: t,
  child,
  role,
  accountId,
  busy,
  run,
}: {
  trip: FamilyTrip;
  child?: FamilyChild;
  role: 'passenger' | 'driver';
  accountId: string;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  useTheme();
  const api = useApi();
  const [name, setName] = useState('');
  const [recipient, setRecipient] = useState(child?.recipients[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [incident, setIncident] = useState('');
  const [contact, setContact] = useState(false);
  const [journal, setJournal] = useState(false);
  const advance = (
    extra: {
      proof?: string;
      childName?: string;
      recipientId?: string;
      code?: string;
    } = {},
  ) =>
    run(() =>
      api.prototype.advance(t.id, { expectedStatus: t.status, ...extra }),
    );
  const driverFirstName = t.driverName.split(' ')[0];
  const live = t.status === 'en_route' || t.status === 'in_progress';
  const handedTo = child?.recipients.find((r) => r.id === t.recipientId);
  const card = familyCard();
  return (
    <View style={{ gap: 14 }} testID={`family-trip-${t.id}`}>
      {/* ── Status ── */}
      <View style={card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text weight="semibold" numberOfLines={1} style={{ flex: 1, fontSize: 17, lineHeight: 23 }} accessibilityLabel={`${t.childName} · ${FAMILY_STATUS_LABELS[t.status]}`}>
            {t.childName}
          </Text>
          <FamilyStatusChip status={t.status} />
        </View>
        <Text tone="muted" numeric style={{ fontSize: 13, lineHeight: 18, marginTop: -6 }}>
          {t.kind ? `${FAMILY_TRIP_KINDS[t.kind]} · ` : ''}
          {formatShort(t.pickupAt)}
        </Text>
        <TripStepper status={t.status} />
      </View>

      {/* ── Map ── */}
      <View style={{ height: 200, borderRadius: 20, overflow: 'hidden' }}>
        <NayaMap
          center={t.location}
          route={t.route ?? [t.pickup.location, t.destination.location]}
          fitTo={[t.pickup.location, t.destination.location]}
          markers={[
            { id: 'pickup', kind: 'pickup', coordinate: t.pickup.location },
            { id: 'destination', kind: 'destination', coordinate: t.destination.location },
            { id: 'driver', kind: 'driver', coordinate: t.location },
          ]}
        />
        {live ? (
          <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.surface, ...shadow.card }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }} />
            <Text weight="semibold" style={{ fontSize: 12, lineHeight: 16 }}>En direct · démo</Text>
          </View>
        ) : null}
      </View>
      {t.stoppedAt ? (
        <StatusBanner compact tone="warning" title="Véhicule à l’arrêt" message="La famille est prévenue en cas d’arrêt prolongé." />
      ) : null}

      {/* ── Route and driver ── */}
      <View style={card}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ alignItems: 'center', paddingTop: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
            <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: colors.line, marginVertical: 3 }} />
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.ink }} />
          </View>
          <View style={{ flex: 1, gap: 14 }}>
            <View>
              <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>Départ</Text>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{t.pickup.label}</Text>
            </View>
            <View>
              <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>Arrivée</Text>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{t.destination.label}</Text>
            </View>
          </View>
        </View>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="bold" tone="accent" style={{ fontSize: 17, lineHeight: 22 }}>{t.driverName.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{t.driverName}</Text>
            <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
              {t.vehicle ? `${t.vehicle.make} ${t.vehicle.model} · ${t.vehicle.color} · ${t.vehicle.plate}` : 'Chauffeuse dédiée'}
            </Text>
          </View>
          {role === 'passenger' && t.status !== 'completed' ? (
            <Button label="Contacter" size="compact" variant="secondary" onPress={() => setContact(true)} testID="family-contact" accessibilityHint={`Contacter ${driverFirstName}`} />
          ) : null}
        </View>
      </View>

      {/* ── Child ── */}
      {child ? (
        <View style={card}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            {child.photo ? <Attachment id={child.photo} accountId={accountId} label={`Photo de ${child.firstName}`} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{child.firstName} · {child.age} ans</Text>
              <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{child.school}</Text>
            </View>
          </View>
          {child.notes ? (
            <View style={{ backgroundColor: colors.warningSoft, borderRadius: 14, padding: 12, gap: 2 }}>
              <Text weight="semibold" tone="warning" style={{ fontSize: 12, lineHeight: 16 }}>Informations importantes</Text>
              <Text style={{ fontSize: 14, lineHeight: 20 }}>{child.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Next step ── */}
      {t.status !== 'completed' ? (
        <View style={card}>
          <Text weight="semibold" tone={role === 'passenger' ? 'accent' : 'ink'} style={{ fontSize: 13, lineHeight: 18 }}>
            {role === 'passenger' ? 'Démo · simuler les étapes de la chauffeuse' : 'Étape suivante'}
          </Text>
          {t.status === 'scheduled' ? (
            <Button label="Je pars chercher l’enfant" full loading={busy} onPress={() => advance()} testID="family-depart" />
          ) : null}
          {t.status === 'en_route' ? (
            <>
              <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>À l’arrivée, une photo du point de récupération est envoyée au parent.</Text>
              <Button
                label="Prendre une photo d’arrivée"
                full
                loading={busy}
                onPress={() =>
                  run(async () => {
                    const f = await pickFile('camera');
                    if (!f || f === 'denied') return;
                    const u = await uploadFile(api, f, 'support_attachment');
                    await api.prototype.advance(t.id, { expectedStatus: t.status, proof: u.id });
                  })
                }
              />
              <Button label="Photo d’arrivée (simulation)" full variant="secondary" loading={busy} onPress={() => advance({ proof: 'demo-arrival-photo' })} testID="family-arrived" />
            </>
          ) : null}
          {t.status === 'arrived' ? (
            <>
              <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Vérifiez l’enfant avec sa photo, puis saisissez son prénom.</Text>
              <FormField label="Prénom de l’enfant vérifié" value={name} onChangeText={setName} testID="family-child-name" />
              <Button label="Enfant récupéré" full loading={busy} onPress={() => advance({ childName: name })} testID="family-picked-up" />
            </>
          ) : null}
          {t.status === 'picked_up' ? (
            <Button label="Démarrer le trajet" full loading={busy} onPress={() => advance()} testID="family-start" />
          ) : null}
          {t.status === 'in_progress' ? (
            <>
              <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Remise à une personne autorisée</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {child?.recipients.map((r) => (
                  <Pill key={r.id} label={`${r.name} · ${r.relationship}${r.phone ? ` · ${r.phone}` : ''}`} selected={recipient === r.id} onPress={() => setRecipient(r.id)} />
                ))}
              </View>
              <FormField label="Code donné par la personne" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={4} testID="family-code" />
              {role === 'passenger' ? (
                <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>
                  Code démo à communiquer : {child?.recipients.find((r) => r.id === recipient)?.verificationCode}
                </Text>
              ) : null}
              <Button label="Confirmer l’arrivée et la remise" full loading={busy} onPress={() => advance({ recipientId: recipient, code })} testID="family-complete" />
              <Button
                label={t.stoppedAt ? 'Reprendre le trajet (démo)' : 'Simuler un arrêt inhabituel (démo)'}
                variant="ghost"
                full
                loading={busy}
                onPress={() => run(() => api.prototype.stop(t.id, !t.stoppedAt))}
                testID="family-stop"
              />
            </>
          ) : null}
        </View>
      ) : (
        <StatusBanner
          compact
          tone="success"
          title={handedTo ? `Remis·e à ${handedTo.name} (${handedTo.relationship})` : 'Remise confirmée'}
          message="Le prochain trajet récurrent apparaît dans la liste."
        />
      )}

      {/* ── Safety ── */}
      {t.status !== 'completed' ? (
        <View style={card}>
          <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Sécurité</Text>
          <SafetyButton familyTripId={t.id} location={t.location} />
          <FormField label="Retard ou incident" value={incident} onChangeText={setIncident} />
          <Button
            label={role === 'driver' ? 'Signaler à la famille' : 'Signaler à Naya'}
            variant="secondary"
            full
            loading={busy}
            disabled={!incident.trim()}
            onPress={() =>
              run(async () => {
                await api.prototype.incident(t.id, incident);
                setIncident('');
              })
            }
          />
        </View>
      ) : null}

      {/* ── Notifications ── */}
      {role === 'passenger' && t.notifications.length ? (
        <View style={card}>
          <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Notifications</Text>
          {t.notifications
            .slice()
            .reverse()
            .map((n, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: i === 0 ? colors.accent : colors.line }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, lineHeight: 20 }}>{n.title}</Text>
                  <Text tone="muted" numeric style={{ fontSize: 12, lineHeight: 16 }}>{formatShort(n.at)}</Text>
                </View>
              </View>
            ))}
        </View>
      ) : null}

      {/* ── Traceability (collapsed) ── */}
      <View style={card}>
        <PressableScale onPress={() => { haptic.select(); setJournal(!journal); }} accessibilityRole="button" accessibilityState={{ expanded: journal }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} testID="family-journal">
          <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Traçabilité</Text>
          <Text weight="semibold" tone="accent" style={{ fontSize: 13, lineHeight: 18 }}>{journal ? 'Masquer' : 'Afficher'}</Text>
        </PressableScale>
        {(t.incidents ?? []).map((x, i) => (
          <Text key={i} tone="danger" numeric style={{ fontSize: 13, lineHeight: 18 }}>
            {formatShort(x.at)} · {x.source === 'auto' ? 'Alerte automatique' : x.by} · {x.message}
          </Text>
        ))}
        {journal ? (
          <View style={{ gap: 6 }}>
            {STEP_TIMES.map(([step, label]) =>
              t.times?.[step] ? (
                <Text key={step} tone="muted" numeric style={{ fontSize: 13, lineHeight: 18 }}>{label} · {formatShort(t.times[step]!)}</Text>
              ) : null,
            )}
            <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, marginTop: 6 }}>Journal GPS</Text>
            {t.timeline.map((e, i) => (
              <Text key={i} tone="muted" numeric style={{ fontSize: 12, lineHeight: 17 }}>
                {formatShort(e.at)} · {e.label} · {e.location.lat.toFixed(4)}, {e.location.lng.toFixed(4)}
                {e.proof ? ' · preuve jointe' : ''}
              </Text>
            ))}
          </View>
        ) : null}
        {t.arrivalProof && t.arrivalProof !== 'demo-arrival-photo' ? (
          <Attachment id={t.arrivalProof} accountId={role === 'driver' ? t.driverId : t.passengerId} label="Photo d’arrivée" />
        ) : null}
        {t.arrivalProof ? (
          <Text tone="accent" style={{ fontSize: 13, lineHeight: 18 }}>{t.arrivalProof === 'demo-arrival-photo' ? 'Photo d’arrivée simulée' : 'Photo d’arrivée enregistrée'}</Text>
        ) : null}
      </View>

      <Sheet visible={contact} onClose={() => setContact(false)} title={`Contacter ${driverFirstName}`} subtitle="Vos numéros restent masqués.">
        <View style={{ gap: 12 }}>
          <StatusBanner compact tone="warning" title="Démo" message="appel masqué : fournisseur non configuré" />
          <ListGroup>
            <ListRow title="Appeler via Naya" subtitle="Indisponible · fournisseur non configuré" />
            <ListRow title="Envoyer un message" subtitle="Indisponible · fournisseur non configuré" />
            <ListRow title="Urgence · police (19)" subtitle="Appel direct depuis votre téléphone" onPress={() => Linking.openURL('tel:19')} />
          </ListGroup>
        </View>
      </Sheet>
    </View>
  );
}
