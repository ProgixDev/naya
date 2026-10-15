import { useTheme, activeFamilyTrip, nextFamilyTrip, useFamily, Avatar, avatarFor, Button, DEMO_MODE, Glass, NayaMap, PressableScale, Skeleton, StatusBanner, StatusIcon, Text, haptic, toast } from '@naya/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { Linking, ScrollView, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigation } from 'lucide-react-native';
import { errorMessage, isApiError, qk, type EligibilityReason } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatShort, formatMoney, statusPresentation, type Centimes, type LatLng, type VerificationStatus } from '@naya/domain';
import { startOfTodayUtc } from '@/lib/time';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { useAccountId, useDriverStatus, useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { useForegroundLocation } from '@/lib/location';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { ActionNote, StatTile } from '@/components/Kit';

const RABAT = { lat: 34.0189, lng: -6.8367 };

/** Most blocking first: the first reason the driver can lift herself becomes the card's action (R12). */
const PRIORITY: EligibilityReason['code'][] = ['account_suspended', 'debt_limit', 'identity_not_approved', 'vehicle_not_approved', 'city_unavailable'];

/** A dossier the driver must act on (complete or correct), as opposed to one waiting on a reviewer. */
const needsFix = (status: string) => status === 'draft' || status === 'more_info_requested' || status === 'rejected';

interface Unblock {
  label: string;
  onPress: () => void;
}

/** The action that lifts a block, when the driver can lift it herself. Waiting on a reviewer or on the city has none. */
function unblockFor(r: EligibilityReason): Unblock | null {
  switch (r.code) {
    case 'debt_limit':
      return { label: 'Recharger mon portefeuille', onPress: () => router.push('/recharge') };
    case 'identity_not_approved':
      return needsFix(r.status) ? { label: r.status === 'draft' ? 'Compléter mon dossier' : 'Corriger mon dossier', onPress: () => router.push('/docs/status') } : null;
    case 'vehicle_not_approved':
      return needsFix(r.status) ? { label: r.status === 'draft' ? 'Compléter le dossier véhicule' : 'Corriger le dossier véhicule', onPress: () => router.push('/docs/status') } : null;
    case 'account_suspended':
      return { label: 'Contacter l’assistance', onPress: () => router.push('/support') };
    case 'city_unavailable':
      return null;
  }
}

/** One line for the status row and the disabled button: why she cannot go online. */
function blockedLine(r: EligibilityReason): string {
  switch (r.code) {
    case 'debt_limit':
      return 'Plafond de dette atteint';
    case 'identity_not_approved':
      return needsFix(r.status) ? 'Dossier chauffeuse à corriger' : 'Dossier chauffeuse en cours d’examen';
    case 'vehicle_not_approved':
      return needsFix(r.status) ? 'Dossier véhicule à corriger' : 'Véhicule en cours d’examen';
    case 'city_unavailable':
      return 'Ville en phase de test';
    case 'account_suspended':
      return 'Compte suspendu';
  }
}

/**
 * A blocking reason as a note with its own state glyph (A106, C7, C20). `primary` means the card's
 * main button already carries its action, so the note does not repeat it.
 */
function ReasonNote({ reason: r, primary }: { reason: EligibilityReason; primary: boolean }) {
  const testID = `reason-${r.code}`;
  switch (r.code) {
    case 'debt_limit': {
      const debt = Math.max(0, -r.balance) as Centimes;
      return (
        <ActionNote
          kind="driverAvailability"
          state="blocked"
          title="Plafond de dette atteint"
          message={`Solde ${formatMoney(r.balance)} · plafond ${formatMoney(r.limit)}. Une recharge confirmée de ${formatMoney(debt)} solde votre dette.`}
          action={primary ? undefined : { label: 'Recharger', onPress: () => router.push('/recharge') }}
          testID={testID}
        />
      );
    }
    case 'identity_not_approved':
    case 'vehicle_not_approved': {
      const person = r.code === 'identity_not_approved';
      const fix = needsFix(r.status);
      return (
        <ActionNote
          kind="verification"
          state={r.status as VerificationStatus}
          title={person ? (fix ? 'Dossier chauffeuse à corriger' : 'Dossier chauffeuse en examen') : fix ? 'Dossier véhicule à corriger' : 'Véhicule en examen'}
          message={fix ? 'Corrigez les pièces signalées pour passer en ligne.' : person ? 'Identité et permis en cours d’examen par Naya.' : 'Il doit être approuvé pour passer en ligne.'}
          action={primary ? undefined : { label: 'Dossier', onPress: () => router.push('/docs/status') }}
          testID={testID}
        />
      );
    }
    case 'city_unavailable':
      return <ActionNote kind="city" state="test" title="Ville en phase de test" message="Naya n’accepte pas encore de courses dans cette ville pour votre compte." testID={testID} />;
    case 'account_suspended':
      return <ActionNote kind="account" state="suspended" title="Compte suspendu" message="Contactez l’assistance pour en savoir plus." action={primary ? undefined : { label: 'Assistance', onPress: () => router.push('/support') }} testID={testID} />;
  }
}

/** D-02: 22/700 tabular, never wrapped (shrinks to 0.8), « MAD » as a 13 suffix. */
function TileAmount({ amount, tone = 'ink' }: { amount: Centimes; tone?: 'ink' | 'danger' }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Text variant="title" weight="bold" tone={tone} numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3} style={{ fontSize: 22, lineHeight: 28, flexShrink: 1 }}>
        {formatMoney(amount, { currency: false })}
      </Text>
      <Text variant="caption" weight="semibold" tone="muted" maxFontSizeMultiplier={1.3}>
        MAD
      </Text>
    </View>
  );
}

/** D06 · D06-online · D06-debt · D06-gps · D06-docs · D06-restored · D06-casa */
export default function Dashboard() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { restored } = useLocalSearchParams<{ restored?: string }>();
  const me = useMe();
  const status = useDriverStatus();
  const earnings = useQuery({ queryKey: qk.earnings(a, startOfTodayUtc(), null), queryFn: () => api.driver.earnings(startOfTodayUtc(), null), refetchInterval: 15_000 });
  const location = useForegroundLocation();
  const demoAccepted = usePrefs((s) => s.demoPositionAccepted);
  const setDemoAccepted = usePrefs((s) => s.setDemoPositionAccepted);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [cardHeight, setCardHeight] = useState(320);
  const d = status.data;
  const online = !!d?.online;

  const toggle = useMutation({
    mutationFn: async (goOnline: boolean) => {
      let where: LatLng | null = null;
      if (goOnline) {
        const r = await location.request();
        if (r === 'denied') {
          if (!demoAccepted) throw new Error('GPS_DENIED');
        } else where = r;
      }
      return api.driver.setOnline(goOnline, where);
    },
    onSuccess: (s) => {
      setGpsDenied(false);
      haptic.success();
      qc.setQueryData(qk.driverStatus(a), s);
    },
    onError: (e) => {
      if (e instanceof Error && e.message === 'GPS_DENIED') {
        setGpsDenied(true);
        haptic.warning();
        return;
      }
      haptic.error();
      if (isApiError(e)) qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
      toast(errorMessage(e), 'danger');
    },
  });

  const position = d?.presence?.location ?? RABAT;
  const reasons = useMemo(() => [...(d?.eligibility.reasons ?? [])].sort((x, y) => PRIORITY.indexOf(x.code) - PRIORITY.indexOf(y.code)), [d?.eligibility.reasons]);
  const blocked = !!d && !d.eligibility.eligible;
  const primaryReason = reasons.find((r) => unblockFor(r) !== null) ?? null;
  const unblock = primaryReason ? unblockFor(primaryReason) : null;
  const firstName = me.data?.user.firstName ?? '';
  const family = useFamily(a, me.data?.user.familleEligibility === 'approved');
  const familyTrip = activeFamilyTrip(family.data) ?? nextFamilyTrip(family.data);
  const rideCount = earnings.data?.rideCount ?? 0;
  const availability = blocked ? 'blocked' : online ? 'online' : 'offline';
  const statusLine = blocked && reasons[0] ? `Bloquée · ${blockedLine(reasons[0])}` : online ? `Propositions en direct · ${d?.city.offerTimeoutSeconds ?? 30} s pour répondre` : 'Choisissez quand prendre la route';

  // DRV-14: the card never runs under the top controls. With the largest text it scrolls inside;
  // the main action stays pinned at its bottom.
  const cardBottom = TAB_BAR_SPACE + insets.bottom - 8;
  const cardMax = windowHeight - cardBottom - (insets.top + 8 + 44 + 12);

  let action: ReactNode = null;
  if (d && online) {
    // D-04: once online, going offline is a 36 secondary, not a full-width outline that reads as the primary.
    action = (
      <View style={{ alignItems: 'center' }}>
        <Button label="Passer hors ligne" variant="secondary" size="compact" loading={toggle.isPending} onPress={() => toggle.mutate(false)} testID="toggle-online" />
      </View>
    );
  } else if (d) {
    action = unblock ? (
      // R12: the action that lifts the block replaces a disabled « Passer en ligne ».
      <Button label={unblock.label} size="major" full onPress={unblock.onPress} testID="unblock-action" />
    ) : (
      <Button
        label="Passer en ligne"
        size="major"
        full
        disabled={blocked}
        disabledReason={blocked && reasons[0] ? blockedLine(reasons[0]) : undefined}
        loading={toggle.isPending}
        onPress={() => toggle.mutate(true)}
        testID="toggle-online"
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.map }} testID="dashboard">
      <NayaMap center={position} zoom={14} markers={[{ id: 'me', kind: online ? 'driver' : 'me', coordinate: position, label: 'Vous' }]} bottomInset={Math.min(cardHeight, cardMax) + 24} interactive />
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, flexDirection: 'row', alignItems: 'center', gap: 12 }} pointerEvents="box-none">
        {/* D-03, A104: the city once, without a pin (the pill is not a control). */}
        <View accessible accessibilityLabel={d?.city ? `Ville : ${d.city.name}${d.city.status === 'test' ? ', ville en test' : ''}` : 'Ville'} style={{ flexShrink: 1 }}>
          <Glass radius={999} contentStyle={{ minHeight: 44, paddingHorizontal: 16, gap: 8 }}>
            <Text variant="label" weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.3} testID="city-pill" style={{ flexShrink: 1 }}>
              {d?.city.name ?? 'Rabat'}
            </Text>
            {d?.city.status === 'test' ? <StatusIcon kind="city" state="test" size="sm" showLabel accessible={false} /> : null}
          </Glass>
        </View>
        <View style={{ flex: 1 }} />
        <PressableScale onPress={() => router.navigate('/account')} accessibilityRole="button" accessibilityLabel="Mon compte">
          <Avatar name={firstName || 'Naya'} source={avatarFor(firstName)} size={44} />
        </PressableScale>
      </View>

      <View
        onLayout={(e) => setCardHeight(Math.round(e.nativeEvent.layout.height))}
        style={{ position: 'absolute', left: 16, right: 16, bottom: cardBottom, maxHeight: cardMax, backgroundColor: colors.surface, borderRadius: radius.sheet, ...shadow.float, overflow: 'hidden' }}
      >
        {status.isLoading ? (
          <View style={{ gap: 12, padding: 20 }}>
            <Skeleton width="50%" height={18} />
            <Skeleton height={48} />
            <Skeleton height={50} radius={25} />
          </View>
        ) : d ? (
          <>
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: action ? 12 : 20, gap: 16 }} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
              {/* D-04, A105, C20: the availability is a glyph (pulsing Radar, PowerOff, Lock), its word in the title. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <StatusIcon kind="driverAvailability" state={availability} variant="disc" showLabel={false} announce testID="online-glyph" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="heading" accessibilityRole="header" testID="online-state">
                    {online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}
                  </Text>
                  <Text variant="caption" tone={blocked ? 'danger' : 'muted'} weight={blocked ? 'semibold' : undefined} numeric testID="online-sub">
                    {statusLine}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <StatTile label="Net aujourd’hui" foot={`${rideCount} course${rideCount > 1 ? 's' : ''}`} onPress={() => router.navigate('/earnings')} accessibilityLabel={`Revenus nets aujourd’hui ${formatMoney(earnings.data?.net ?? 0)}, ${rideCount} course${rideCount > 1 ? 's' : ''}`} testID="home-earnings">
                  <TileAmount amount={earnings.data?.net ?? 0} />
                </StatTile>
                <StatTile label="Portefeuille" foot="Solde comptable" onPress={() => router.navigate('/wallet')} accessibilityLabel={`Portefeuille ${formatMoney(d.wallet.balance)}`} testID="home-wallet">
                  <TileAmount amount={d.wallet.balance} tone={d.wallet.offersBlockedByDebt ? 'danger' : 'ink'} />
                </StatTile>
              </View>

              {restored ? <StatusBanner compact tone="success" title="Accès rétabli" message="solde repassé sous le plafond" testID="restored-banner" /> : null}
              {d.activeRide ? <ActionNote kind="ride" state={d.activeRide.status} title={`Course ${d.activeRide.id} en cours`} message="Reprenez le guidage." action={{ label: 'Reprendre', onPress: () => router.push('/ride') }} testID="resume-ride" /> : null}
              {familyTrip ? (
                <ActionNote
                  kind="familyTrip"
                  state={familyTrip.status}
                  viewer="driver"
                  title={`Naya Famille · ${familyTrip.childName}`}
                  message={familyTrip.status === 'scheduled' ? `Prise en charge ${formatShort(familyTrip.pickupAt)} · ${familyTrip.pickup.label}` : statusPresentation('familyTrip', familyTrip.status, { viewer: 'driver' }).label}
                  action={{ label: 'Ouvrir', onPress: () => router.push({ pathname: '/family/[id]', params: { id: familyTrip.id } }) }}
                  testID="home-famille"
                />
              ) : null}
              {d.awaitingCashRide ? (
                <ActionNote
                  kind="payment"
                  state="pending"
                  title={`Espèces à confirmer · ${d.awaitingCashRide.id}`}
                  message={`${formatMoney(d.awaitingCashRide.terms.breakdown.total)} à encaisser.`}
                  action={{ label: 'Confirmer', onPress: () => router.push({ pathname: '/ride-end/[id]', params: { id: d.awaitingCashRide!.id } }) }}
                  testID="cash-pending"
                />
              ) : null}
              {reasons.slice(0, 2).map((r) => (
                <ReasonNote key={r.code} reason={r} primary={!online && r === primaryReason} />
              ))}
              {gpsDenied ? (
                <ActionNote
                  kind="location"
                  state="off"
                  title="Localisation refusée"
                  message="Sans position, pas de courses proches."
                  action={{ label: 'Réglages', onPress: () => Linking.openSettings().catch(() => toast('Autorisez la localisation dans les réglages du navigateur.')) }}
                  testID="gps-denied"
                />
              ) : null}
              {gpsDenied && DEMO_MODE ? (
                // Mock backend only: go online from the last position the server knows for this account.
                <Button
                  label="Utiliser ma dernière position connue"
                  variant="secondary"
                  full
                  icon={<Navigation size={16} color={colors.accent} strokeWidth={2} />}
                  onPress={() => {
                    setDemoAccepted(true);
                    toggle.mutate(true);
                  }}
                  testID="use-demo-position"
                />
              ) : null}
            </ScrollView>
            {action ? <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>{action}</View> : null}
          </>
        ) : (
          <View style={{ padding: 20 }}>
            <StatusBanner tone="danger" title="Statut indisponible" message="Impossible de joindre Naya. Vérifiez votre connexion." action={{ label: 'Réessayer', onPress: () => status.refetch() }} />
          </View>
        )}
      </View>
    </View>
  );
}
