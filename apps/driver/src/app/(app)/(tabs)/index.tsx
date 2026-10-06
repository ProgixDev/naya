import { useTheme , Avatar, avatarFor, Button, DEMO_MODE, DemoBadge, Glass, IconButton, Money, NayaMap, PressableScale, Skeleton, StatusBanner, Text, haptic, toast } from '@naya/ui';
import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Navigation } from 'lucide-react-native';
import { errorMessage, isApiError, qk, type EligibilityReason } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, type LatLng } from '@naya/domain';
import { startOfTodayUtc } from '@/lib/time';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { useAccountId, useDriverStatus, useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { useForegroundLocation } from '@/lib/location';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { ActionNote, StatTile } from '@/components/Kit';

const RABAT = { lat: 34.0189, lng: -6.8367 };

function reasonBanner(r: EligibilityReason) {
  switch (r.code) {
    case 'debt_limit':
      return { key: r.code, tone: 'danger' as const, title: 'Plafond de dette atteint', message: `Solde ${formatMoney(r.balance)} · nouvelles propositions bloquées.`, action: { label: 'Recharger', onPress: () => router.push('/recharge') } };
    case 'identity_not_approved':
      return { key: r.code, tone: 'warning' as const, title: 'Dossier chauffeuse en attente', message: 'Identité et permis à faire approuver.', action: { label: 'Dossier', onPress: () => router.push('/docs/status') } };
    case 'vehicle_not_approved':
      return { key: r.code, tone: 'warning' as const, title: 'Véhicule en attente', message: 'Il doit être approuvé pour passer en ligne.', action: { label: 'Dossier', onPress: () => router.push('/docs/status') } };
    case 'city_unavailable':
      return { key: r.code, tone: 'info' as const, title: 'Ville en phase de test', message: 'Naya n’accepte pas encore de courses dans cette ville pour votre compte.' };
    case 'account_suspended':
      return { key: r.code, tone: 'danger' as const, title: 'Compte suspendu', message: 'Contactez l’assistance pour en savoir plus.', action: { label: 'Assistance', onPress: () => router.push('/support') } };
  }
}

/** D06 · D06-online · D06-debt · D06-gps · D06-docs · D06-restored · D06-casa */
export default function Dashboard() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const { restored } = useLocalSearchParams<{ restored?: string }>();
  const me = useMe();
  const status = useDriverStatus();
  const earnings = useQuery({ queryKey: qk.earnings(a, startOfTodayUtc(), null), queryFn: () => api.driver.earnings(startOfTodayUtc(), null), refetchInterval: 15_000 });
  const location = useForegroundLocation();
  const demoAccepted = usePrefs((s) => s.demoPositionAccepted);
  const setDemoAccepted = usePrefs((s) => s.setDemoPositionAccepted);
  const [gpsDenied, setGpsDenied] = useState(false);
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
  const cityLabel = d?.city ? `${d.city.name}${d.city.status === 'test' ? ' · test' : ' · Centre-ville'}` : 'Rabat · Centre-ville';
  const banners = useMemo(() => (d?.eligibility.reasons ?? []).map(reasonBanner).filter(Boolean), [d?.eligibility.reasons]);
  const blocked = !!d && !d.eligibility.eligible;
  const firstName = me.data?.user.firstName ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.map }} testID="dashboard">
      <NayaMap center={position} zoom={14} markers={[{ id: 'me', kind: online ? 'driver' : 'me', coordinate: position, label: 'Vous' }]} bottomInset={380} interactive />
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter, right: gutter, flexDirection: 'row', alignItems: 'center', gap: 12 }} pointerEvents="box-none">
        <Glass radius={999} contentStyle={{ height: 44, paddingHorizontal: 16, gap: 8 }}>
          <MapPin size={18} color={colors.ink} />
          <Text variant="label" numberOfLines={1} testID="city-pill">
            {cityLabel}
          </Text>
        </Glass>
        {DEMO_MODE ? (
          <PressableScale onPress={() => router.push('/dev')} accessibilityRole="button" accessibilityLabel="Lanceur de scénarios de démonstration" hitSlop={12}>
            <DemoBadge />
          </PressableScale>
        ) : null}
        <View style={{ flex: 1 }} />
        <PressableScale onPress={() => router.navigate('/account')} accessibilityRole="button" accessibilityLabel="Mon compte"><Avatar name={firstName || 'Naya'} source={avatarFor(firstName)} size={44} /></PressableScale>
      </View>

      <View style={{ position: 'absolute', left: 16, right: 16, bottom: TAB_BAR_SPACE + insets.bottom - 8, backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 20, gap: 16, ...shadow.float }}>
        {status.isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="50%" height={18} />
            <Skeleton height={48} />
            <Skeleton height={50} radius={25} />
          </View>
        ) : d ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <Text variant="title">{firstName ? `Bonjour ${firstName}` : 'Votre journée'}</Text>
              <Text variant="micro" tone="muted">{d.city.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }} accessible accessibilityLabel={online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: online ? colors.success : colors.surface, borderWidth: 2, borderColor: online ? colors.success : colors.ink }} />
              <View style={{ flex: 1 }}>
                <Text variant="label" weight="semibold" testID="online-state">
                  {online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}
                </Text>
                <Text variant="micro" tone="muted" numberOfLines={1}>
                  {online ? 'Propositions en direct · 30 s pour répondre' : blocked ? 'Réglez le point ci-dessous pour passer en ligne' : 'Choisissez quand prendre la route'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatTile label="Revenus nets" foot={`Aujourd’hui · ${earnings.data?.rideCount ?? 0} course${(earnings.data?.rideCount ?? 0) > 1 ? 's' : ''}`} onPress={() => router.navigate('/earnings')} accessibilityLabel={`Revenus nets aujourd’hui ${formatMoney(earnings.data?.net ?? 0)}`}>
                <Money amount={earnings.data?.net ?? 0} variant="title" />
              </StatTile>
              <StatTile label="Portefeuille" foot="Solde comptable" onPress={() => router.navigate('/wallet')} accessibilityLabel={`Portefeuille ${formatMoney(d.wallet.balance)}`} testID="home-wallet">
                <Money amount={d.wallet.balance} variant="title" tone={d.wallet.offersBlockedByDebt ? 'danger' : 'ink'} />
              </StatTile>
            </View>

            {restored ? <StatusBanner compact tone="success" title="Accès rétabli" message="solde repassé sous le plafond" testID="restored-banner" /> : null}
            {d.activeRide ? <ActionNote tone="info" title={`Course ${d.activeRide.id} en cours`} message="Reprenez le guidage." action={{ label: 'Reprendre', onPress: () => router.push('/ride') }} testID="resume-ride" /> : null}
            {d.awaitingCashRide ? <ActionNote tone="warning" title={`Espèces à confirmer · ${d.awaitingCashRide.id}`} message={`${formatMoney(d.awaitingCashRide.terms.breakdown.total)} à encaisser.`} action={{ label: 'Confirmer', onPress: () => router.push({ pathname: '/ride-end/[id]', params: { id: d.awaitingCashRide!.id } }) }} testID="cash-pending" /> : null}
            {banners.slice(0, 2).map((b) => (b ? <ActionNote key={b.key} tone={b.tone} title={b.title} message={b.message} action={b.action} testID={`reason-${b.key}`} /> : null))}
            {gpsDenied ? (
              <ActionNote
                tone="warning"
                title="Localisation refusée"
                message="Sans position, pas de courses proches."
                action={{ label: 'Réglages', onPress: () => Linking.openSettings().catch(() => toast('Autorisez la localisation dans les réglages du navigateur.')) }}
                testID="gps-denied"
              />
            ) : null}
            {gpsDenied && DEMO_MODE ? (
              <Button
                label="Utiliser la position de démo"
                variant="secondary"
                full
                icon={<Navigation size={16} color={colors.accent} />}
                onPress={() => {
                  setDemoAccepted(true);
                  toggle.mutate(true);
                }}
                testID="use-demo-position"
              />
            ) : null}

            <Button
              label={online ? 'Passer hors ligne' : 'Passer en ligne'}
              variant={online ? 'secondary' : 'primary'}
              size="major"
              full
              disabled={!online && blocked}
              loading={toggle.isPending}
              onPress={() => toggle.mutate(!online)}
              testID="toggle-online"
            />
          </>
        ) : (
          <StatusBanner tone="danger" title="Statut indisponible" message="Impossible de joindre Naya. Vérifiez votre connexion." action={{ label: 'Réessayer', onPress: () => status.refetch() }} />
        )}
      </View>
    </View>
  );
}
