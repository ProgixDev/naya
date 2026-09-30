import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Check, ChevronRight, CreditCard, SlidersHorizontal, TrendingUp } from 'lucide-react-native';
import {
  casablancaLocalToUtc,
  formatDistance,
  formatDuration,
  formatMoney,
  formatMultiplier,
  type Quote,
} from '@naya/domain';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import { cars, aspect } from '@naya/assets';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import {
  Button,
  ErrorState,
  FareBreakdown,
  IconButton,
  Illustration,
  ListGroup,
  ListRow,
  Money,
  NayaMap,
  PressableScale,
  SegmentedControl,
  Sheet,
  Skeleton,
  StatusBanner,
  Text,
  haptic,
  toast,
  useSingleFlight,
} from '@naya/ui';
import { ArrowLeft } from 'lucide-react-native';
import { draftStops, useDraft } from '@/lib/draft';
import { useAccountId, usePaymentMethods } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { SchedulePicker, firstDay } from '@/features/schedule/SchedulePicker';

export default function QuoteScreen() {
  const params = useLocalSearchParams<{ schedule?: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const draft = useDraft();
  const cityId = usePrefs((s) => s.cityId);
  const stops = draftStops(draft);
  const stopsKey = JSON.stringify(stops?.map((s) => [s.label, s.location.lat, s.location.lng]));
  const quote = useQuery({
    queryKey: ['naya', a, 'quote', cityId, stopsKey],
    queryFn: () => api.quotes.create(cityId, stops!),
    enabled: !!stops,
    staleTime: Infinity,
    retry: false,
  });
  const methods = usePaymentMethods();
  const [mode, setMode] = useState<'now' | 'schedule'>(params.schedule ? 'schedule' : 'now');
  const [pmId, setPmId] = useState<string | null>(null);
  const [showFare, setShowFare] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const q = quote.data;
  const deadline = useDeadline(q?.expiresAt);
  const [day, setDay] = useState(firstDay());
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    if (!methods.data || pmId) return;
    const def = methods.data.find((m) => m.isDefault && m.availableInCity) ?? methods.data.find((m) => m.availableInCity);
    if (def) setPmId(def.id);
  }, [methods.data, pmId]);

  // Quotes are valid 10 minutes. On expiry a fresh quote is fetched and shown before any commitment.
  useEffect(() => {
    if (deadline.expired && q) {
      quote.refetch();
      toast('Le prix a été recalculé');
    }
  }, [deadline.expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const pm = methods.data?.find((m) => m.id === pmId);
  const book = useSingleFlight(
    async (_v: void, key: string) => {
      if (!q || !pm) throw new Error('Choisissez un moyen de paiement.');
      if (mode === 'schedule') {
        if (!time) throw new Error('Choisissez un horaire.');
        return { kind: 'scheduled' as const, result: await api.scheduled.create(q.id, pm.id, casablancaLocalToUtc(day, time), key) };
      }
      return { kind: 'ride' as const, result: await api.rides.create(q.id, pm.id, key) };
    },
    {
      onSuccess: (r) => {
        haptic.success();
        draft.reset();
        qc.invalidateQueries({ queryKey: qk.activeRide(a) });
        qc.invalidateQueries({ queryKey: qk.scheduled(a) });
        if (r.kind === 'ride') router.replace('/ride');
        else {
          toast('Réservation enregistrée');
          router.replace({ pathname: '/scheduled/[id]', params: { id: r.result.id } });
        }
      },
      onError: (e) => {
        haptic.error();
        if (isApiError(e) && e.code === 'QUOTE_EXPIRED') {
          quote.refetch();
          book.reset();
        }
        if (isApiError(e) && e.code === 'ACTIVE_RIDE_EXISTS') router.replace('/ride');
        toast(errorMessage(e), 'danger');
      },
    },
  );

  if (!stops) {
    return <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 60 }}><ErrorState title="Itinéraire incomplet" message="Choisissez un départ et une destination." onRetry={() => router.replace('/route')} /></View>;
  }

  const center = stops[0]!.location;
  const markers = stops.map((s, i) => ({ id: `s${i}`, kind: (i === 0 ? 'pickup' : i === stops.length - 1 ? 'destination' : 'stop') as 'pickup' | 'stop' | 'destination', coordinate: s.location, label: s.label }));
  const total = q?.breakdown.total ?? 0;
  const confirmLabel = mode === 'schedule' ? `Planifier · ${formatMoney(total)}` : `Confirmer · ${formatMoney(total)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="quote">
      <View style={{ height: '42%' }}>
        <NayaMap center={center} markers={markers} route={q?.route.polyline} fitTo={q?.route.polyline ?? stops.map((s) => s.location)} topInset={insets.top + 8} bottomInset={36} />
        <View style={{ position: 'absolute', top: insets.top + 8, left: gutter }}>
          <IconButton icon={<ArrowLeft size={22} color={colors.ink} />} accessibilityLabel="Modifier l’itinéraire" onPress={() => router.back()} testID="quote-back" />
        </View>
      </View>
      <View style={{ flex: 1, marginTop: -28, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, ...shadow.float }}>
        <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 24, gap: 14 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="title" style={{ flex: 1, fontSize: 24, lineHeight: 30 }} accessibilityRole="header">
              Votre trajet
            </Text>
            <IconButton variant="tonal" icon={<SlidersHorizontal size={20} color={colors.ink} />} accessibilityLabel="Modifier l’itinéraire" label="Modifier" onPress={() => router.back()} />
          </View>
          <Text variant="label" tone="muted" numberOfLines={2}>
            {stops.map((s) => s.label).join(' → ')}
          </Text>
          <SegmentedControl
            options={[
              { value: 'now', label: 'Maintenant' },
              { value: 'schedule', label: 'Planifier' },
            ]}
            value={mode}
            onChange={setMode}
            testID="mode"
          />

          {quote.isError ? (
            <StatusBanner tone="danger" title={isApiError(quote.error) && quote.error.code === 'OUT_OF_ZONE' ? 'Hors zone desservie' : 'Prix indisponible'} message={errorMessage(quote.error)} action={{ label: 'Modifier l’itinéraire', onPress: () => router.back() }} testID="quote-error" />
          ) : null}

          <PressableScale onPress={() => q && setShowFare(true)} accessibilityRole="button" accessibilityLabel={q ? `Naya, ${formatMoney(total)}, ${formatDistance(q.route.distanceMeters)}, ${formatDuration(q.route.durationSeconds)}. Voir le détail du prix` : 'Calcul du prix'} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: radius.card, padding: 14 }} testID="fare-card" pressedScale={0.98}>
            <Illustration source={cars.pearlSmall} aspect={aspect.carSmall} width={120} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" weight="semibold">Naya</Text>
              {q ? <Money amount={total} variant="title" style={{ fontSize: 24, lineHeight: 30 }} /> : <Skeleton width={90} height={26} />}
              {q ? (
                <Text variant="caption" tone="muted" numeric>
                  {formatDistance(q.route.distanceMeters)} · {formatDuration(q.route.durationSeconds)}
                </Text>
              ) : (
                <Skeleton width={80} height={12} />
              )}
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </PressableScale>

          {q?.conditions.dynamic ? (
            <StatusBanner
              tone="warning"
              icon={<TrendingUp size={20} color={colors.warning} />}
              title={`Demande élevée · ${formatMultiplier(q.conditions.dynamic.multiplierBp)}`}
              message={`${q.conditions.dynamic.reason} Sans majoration : ${formatMoney(q.breakdown.total - q.breakdown.dynamicSurcharge)}. Ce prix est garanti une fois confirmé.`}
              testID="dynamic-banner"
            />
          ) : null}

          {mode === 'schedule' ? (
            <View style={{ gap: 8 }}>
              <SchedulePicker day={day} time={time} onDay={setDay} onTime={setTime} />
              <Text variant="caption" tone="muted">La réservation est enregistrée ; la recherche d’une chauffeuse commence 15 minutes avant le départ.</Text>
            </View>
          ) : null}

          <ListGroup>
            <ListRow
              testID="payment-row"
              title={pm?.label ?? 'Moyen de paiement'}
              subtitle={pm ? (pm.kind === 'cash' ? 'À régler à la fin du trajet' : 'Débitée à l’arrivée, après confirmation') : 'À choisir'}
              leading={pm?.kind === 'card' ? <CreditCard size={20} color={colors.ink} /> : <Banknote size={20} color={colors.ink} />}
              onPress={() => setShowPay(true)}
            />
          </ListGroup>
        </ScrollView>
        <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 12, paddingTop: 8, gap: 6 }}>
          <Button label={confirmLabel} size="major" full loading={book.isPending} loadingLabel={mode === 'schedule' ? 'Enregistrement…' : 'Envoi de la demande…'} disabled={!q || !pm || (mode === 'schedule' && !time)} disabledReason={!pm ? 'Choisissez un moyen de paiement.' : undefined} onPress={() => book.run()} testID="confirm-booking" />
          <Text variant="micro" tone="muted" align="center">
            {q ? `Annulation gratuite ${Math.round(q.conditions.cancellation.graceSeconds / 60)} min après l’attribution, puis ${formatMoney(q.conditions.cancellation.feeAfterGrace)}.` : 'Le prix reste visible avant confirmation.'}
          </Text>
        </View>
      </View>

      <Sheet visible={showFare} onClose={() => setShowFare(false)} title="Détail du prix" subtitle={q ? `Tarifs ${q.cityId === 'rabat' ? 'Rabat' : 'Casablanca'} · règles v${q.ruleVersion}` : undefined} testID="fare-sheet">
        {q ? <FareDetail q={q} /> : null}
      </Sheet>
      <Sheet visible={showPay} onClose={() => setShowPay(false)} title="Paiement" subtitle="Les moyens proposés dépendent de votre ville." testID="payment-sheet">
        <View style={{ gap: 12 }}>
          <ListGroup>
            {(methods.data ?? []).map((m) => (
              <ListRow
                key={m.id}
                testID={`pm-${m.last4 ?? 'cash'}`}
                title={m.label}
                subtitle={!m.availableInCity ? 'Indisponible dans cette ville' : m.id === pmId ? 'Sélectionné' : undefined}
                leading={m.kind === 'card' ? <CreditCard size={20} color={m.availableInCity ? colors.ink : colors.disabledText} /> : <Banknote size={20} color={colors.ink} />}
                onPress={m.availableInCity ? () => { setPmId(m.id); setShowPay(false); haptic.select(); } : undefined}
                trailing={m.id === pmId ? <Check size={20} color={colors.accent} /> : undefined}
              />
            ))}
          </ListGroup>
          <Button label="Gérer mes moyens de paiement" variant="ghost" full onPress={() => { setShowPay(false); router.push('/payments'); }} />
        </View>
      </Sheet>
    </View>
  );
}

function FareDetail({ q }: { q: Quote }) {
  return (
    <View style={{ gap: 14 }}>
      <FareBreakdown fare={q.breakdown} distanceMeters={q.route.distanceMeters} durationSeconds={q.route.durationSeconds} dynamicReason={q.conditions.dynamic?.reason} />
      <StatusBanner tone="neutral" title="Prix garanti à la confirmation" message={`Ce prix est gelé pour votre course, même si les tarifs changent ensuite. Annulation : gratuite ${Math.round(q.conditions.cancellation.graceSeconds / 60)} min après l’attribution, ${formatMoney(q.conditions.cancellation.feeAfterGrace)} ensuite, ${formatMoney(q.conditions.cancellation.feeAfterArrival)} si la chauffeuse est arrivée.`} />
      {q.conditions.cityStatus === 'test' ? <StatusBanner tone="warning" title="Ville en test" message="Tarifs de test, configurables par l’équipe Naya." /> : null}
    </View>
  );
}
