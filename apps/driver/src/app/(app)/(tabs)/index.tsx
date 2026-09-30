import { useMemo, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Navigation } from 'lucide-react-native';
import { errorMessage, isApiError, qk, type EligibilityReason } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, type LatLng } from '@naya/domain';
import { startOfTodayUtc } from '@/lib/time';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { Button, DEMO_MODE, DemoBadge, Glass, IconButton, Money, NayaMap, PressableScale, Skeleton, StatusBanner, Text, haptic, toast } from '@naya/ui';
import { useAccountId, useDriverStatus, useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { useForegroundLocation } from '@/lib/location';
import { TAB_BAR_SPACE } from '@/components/TabBar';

const RABAT = { lat: 34.0189, lng: -6.8367 };

function reasonBanner(r: EligibilityReason) {
  switch (r.code) {
    case 'debt_limit':
      return { key: r.code, tone: 'danger' as const, title: 'Plafond de dette atteint', message: `Solde : ${formatMoney(r.balance)}. Les nouvelles propositions sont bloquées. Une course en cours n’est jamais interrompue.`, action: { label: 'Recharger', onPress: () => router.push('/recharge') } };
    case 'identity_not_approved':
      return { key: r.code, tone: 'warning' as const, title: 'Dossier chauffeuse en attente', message: 'Votre identité et votre permis doivent être approuvés.', action: { label: 'Voir le dossier', onPress: () => router.push('/docs/status') } };
    case 'vehicle_not_approved':
      return { key: r.code, tone: 'warning' as const, title: 'Véhicule en attente', message: 'Votre véhicule doit être approuvé pour passer en ligne.', action: { label: 'Voir le dossier', onPress: () => router.push('/docs/status') } };
    case 'city_unavailable':
      return { key: r.code, tone: 'info' as const, title: 'Ville en phase de test', message: 'Naya n’accepte pas encore de courses dans cette ville pour votre compte.' };
    case 'account_suspended':
      return { key: r.code, tone: 'danger' as const, title: 'Compte suspendu', message: 'Contactez l’assistance pour en savoir plus.', action: { label: 'Assistance', onPress: () => router.push('/support') } };
  }
}

/** D06 · D06-online · D06-debt · D06-gps · D06-docs · D06-restored · D06-casa */
export default function Dashboard() {
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
        <IconButton icon={<Text variant="label" weight="semibold" tone="accent">{firstName.charAt(0) || 'N'}</Text>} accessibilityLabel="Mon compte" onPress={() => router.navigate('/account')} />
      </View>

      <View style={{ position: 'absolute', left: 12, right: 12, bottom: TAB_BAR_SPACE + insets.bottom - 8, backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 20, gap: 16, ...shadow.float }}>
        {status.isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="50%" height={18} />
            <Skeleton height={48} />
            <Skeleton height={54} radius={27} />
          </View>
        ) : d ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityLabel={online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: online ? colors.success : colors.surface, borderWidth: 2, borderColor: online ? colors.success : colors.ink }} />
              <Text variant="heading" testID="online-state">
                {online ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <PressableScale style={{ flex: 1, gap: 2 }} onPress={() => router.navigate('/earnings')} accessibilityRole="button" accessibilityLabel={`Revenus nets aujourd’hui ${formatMoney(earnings.data?.net ?? 0)}`}>
                <Text variant="caption" tone="muted">
                  Revenus nets
                </Text>
                <Money amount={earnings.data?.net ?? 0} variant="title" />
                <Text variant="micro" tone="muted">
                  Aujourd’hui · {earnings.data?.rideCount ?? 0} course{(earnings.data?.rideCount ?? 0) > 1 ? 's' : ''}
                </Text>
              </PressableScale>
              <PressableScale style={{ flex: 1, gap: 2 }} onPress={() => router.navigate('/wallet')} accessibilityRole="button" accessibilityLabel={`Portefeuille ${formatMoney(d.wallet.balance)}`} testID="home-wallet">
                <Text variant="caption" tone="muted">
                  Portefeuille
                </Text>
                <Money amount={d.wallet.balance} variant="title" tone={d.wallet.offersBlockedByDebt ? 'danger' : 'ink'} />
                <Text variant="micro" tone="muted">
                  Voir les mouvements
                </Text>
              </PressableScale>
            </View>

            {restored ? <StatusBanner tone="success" title="Accès rétabli" message="Votre solde est repassé sous le plafond : vous pouvez de nouveau recevoir des courses." testID="restored-banner" /> : null}
            {d.activeRide ? <StatusBanner tone="info" title={`Course ${d.activeRide.id} en cours`} message="Reprenez le guidage de la course acceptée." action={{ label: 'Reprendre', onPress: () => router.push('/ride') }} testID="resume-ride" /> : null}
            {d.awaitingCashRide ? <StatusBanner tone="warning" title={`Espèces à confirmer · ${d.awaitingCashRide.id}`} message={`Confirmez l’encaissement de ${formatMoney(d.awaitingCashRide.terms.breakdown.total)}.`} action={{ label: 'Confirmer', onPress: () => router.push({ pathname: '/ride-end/[id]', params: { id: d.awaitingCashRide!.id } }) }} testID="cash-pending" /> : null}
            {banners.slice(0, 2).map((b) => (b ? <StatusBanner key={b.key} tone={b.tone} title={b.title} message={b.message} action={b.action} testID={`reason-${b.key}`} /> : null))}
            {gpsDenied ? (
              <StatusBanner
                tone="warning"
                title="Localisation refusée"
                message="Sans votre position, Naya ne peut pas vous proposer de courses proches."
                action={Platform.OS === 'web' || !DEMO_MODE ? { label: 'Ouvrir les réglages', onPress: () => Linking.openSettings().catch(() => toast('Autorisez la localisation dans les réglages du navigateur.')) } : { label: 'Ouvrir les réglages', onPress: () => Linking.openSettings() }}
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

            <Text variant="caption" tone="muted">
              {online ? 'Une proposition peut arriver à tout moment. Vous aurez 30 secondes pour répondre.' : blocked ? 'Réglez les points ci-dessus pour passer en ligne.' : 'Choisissez quand prendre la route.'}
            </Text>
            <Button
              label={online ? 'Passer hors ligne' : 'Passer en ligne'}
              variant={online ? 'secondary' : 'primary'}
              size="major"
              full
              disabled={!online && blocked}
              disabledReason={undefined}
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
