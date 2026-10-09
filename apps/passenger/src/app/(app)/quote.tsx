import { useTheme ,
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
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Bike, Car, Check, ChevronRight, CreditCard, Gem, TrendingUp , ArrowLeft } from 'lucide-react-native';
import {
  casablancaLocalToUtc,
  formatDistance,
  formatDuration,
  formatMoney,
  formatMultiplier,
  type Quote,
  type ServiceCategory,
} from '@naya/domain';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import { cars, aspect } from '@naya/assets';
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { draftStops, useDraft } from '@/lib/draft';
import { useAccountId, usePaymentMethods } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { SchedulePicker, firstDay } from '@/features/schedule/SchedulePicker';

export default function QuoteScreen() {
  useTheme();
  const params = useLocalSearchParams<{ schedule?: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const draft = useDraft();
  const cityId = usePrefs((s) => s.cityId);
  const stops = draftStops(draft);
  const stopsKey = JSON.stringify(stops?.map((s) => [s.label, s.location.lat, s.location.lng]));
  const [picked, setPicked] = useState<string | null>(null);
  const catalog = useQuery({ queryKey: ['naya', a, 'catalog'], queryFn: api.prototype.catalog });
  const cities = useQuery({ queryKey: ['naya', 'cities'], queryFn: api.cities.list });
  const available = catalog.data?.categories.filter((c) => c.enabled && (!c.cityIds.length || c.cityIds.includes(cityId))) ?? [];
  // Categories come from the back-office: default to Standard when offered, else the first one.
  const categoryId = (picked && available.some((c) => c.id === picked) ? picked : null) ?? available.find((c) => c.id === 'standard')?.id ?? available[0]?.id;
  const quote = useQuery({
    queryKey: ['naya', a, 'quote', cityId, stopsKey, categoryId],
    queryFn: () => api.quotes.create(cityId, stops!, categoryId),
    enabled: !!stops && !!categoryId,
    staleTime: Infinity,
    // A quote is single-use: never reuse one from an earlier booking of the same trip.
    gcTime: 0,
    retry: false,
    // Keep the previous list of prices on screen while the new category is priced.
    placeholderData: (prev) => prev,
  });
  const methods = usePaymentMethods();
  const [mode, setMode] = useState<'now' | 'schedule'>(params.schedule ? 'schedule' : 'now');
  const [pmId, setPmId] = useState<string | null>(null);
  const [showFare, setShowFare] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const q = quote.data;
  // The quote on screen belongs to the selected category (not a placeholder from the previous one).
  const current = !!q && !quote.isPlaceholderData && q.service?.id === categoryId;
  const cq = current ? q : undefined;
  const selected = q?.options?.find((o) => o.id === categoryId) ?? available.find((c) => c.id === categoryId);
  const deadline = useDeadline(q?.expiresAt);
  const [day, setDay] = useState(firstDay());
  const [time, setTime] = useState<string | null>(null);



  // Quotes are valid 10 minutes. On expiry a fresh quote is fetched and shown before any commitment.
  useEffect(() => {
    if (deadline.expired && q) {
      quote.refetch();
      toast('Le prix a été recalculé');
    }
  }, [deadline.expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const pm = methods.data?.find((m) => m.id === pmId && m.availableInCity) ?? methods.data?.find(m => m.isDefault && m.availableInCity) ?? methods.data?.find(m => m.availableInCity);
  const book = useSingleFlight(
    async (_v: void, key: string) => {
      if (!q || !current) throw new Error('Le prix est en cours de calcul.');
      if (!pm) throw new Error('Choisissez un moyen de paiement.');
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
        qc.removeQueries({ queryKey: ['naya', a, 'quote'] });
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
        if (isApiError(e) && (e.code === 'QUOTE_EXPIRED' || (e.code === 'CONFLICT' && /devis/.test(e.message)))) {
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
  const serviceName = selected?.name ?? 'Naya';
  const confirmLabel = !current ? 'Calcul du prix…' : mode === 'schedule' ? `Planifier ${serviceName} · ${formatMoney(total)}` : `Confirmer ${serviceName} · ${formatMoney(total)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="quote">
      <View style={{ height: '36%' }}>
        <NayaMap center={center} markers={markers} route={q?.route.polyline} fitTo={q?.route.polyline ?? stops.map((s) => s.location)} topInset={insets.top + 8} bottomInset={36} />
        <View style={{ position: 'absolute', top: insets.top + 8, left: gutter }}>
          <IconButton icon={<ArrowLeft size={22} color={colors.ink} />} accessibilityLabel="Modifier l’itinéraire" onPress={() => router.back()} testID="quote-back" />
        </View>
      </View>
      <View style={{ flex: 1, marginTop: -28, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, ...shadow.float }}>
        <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 12, gap: 16 }} showsVerticalScrollIndicator={false}>
          <Text variant="title" accessibilityRole="header">Votre trajet, tout simplement.</Text>
          <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={`Itinéraire : ${stops.map((s) => s.label).join(', ')}. Modifier`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="label" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
              {stops.map((s) => s.label.replace(/^(Rabat|Casablanca) · /, '')).join(' → ')}
            </Text>
            <Text variant="caption" weight="semibold" tone="accent">Modifier</Text>
          </PressableScale>

          {quote.isError ? (
            <StatusBanner tone="danger" title={isApiError(quote.error) && quote.error.code === 'OUT_OF_ZONE' ? 'Hors zone desservie' : 'Prix indisponible'} message={errorMessage(quote.error)} action={{ label: 'Modifier l’itinéraire', onPress: () => router.back() }} testID="quote-error" />
          ) : null}

          <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Type de véhicule">
            {catalog.isLoading ? <Skeleton width="100%" height={64} /> : null}
            {catalog.data && !available.length ? <StatusBanner tone="warning" title="Aucun service disponible" message="Aucun type de véhicule n’est proposé dans cette ville pour le moment." /> : null}
            {available.map((c) => {
              const on = categoryId === c.id;
              const price = q?.options?.find((o) => o.id === c.id)?.total;
              return (
                <PressableScale key={c.id} onPress={() => { setPicked(c.id); haptic.select(); }} testID={`service-${c.id}`} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${c.name}, arrivée ${c.etaMinutes} min${price != null ? `, ${formatMoney(price)}` : ''}`} pressedScale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.selected : colors.surface }}>
                  <ServiceIcon icon={c.icon} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" weight="semibold" numberOfLines={1}>{c.name}</Text>
                    <Text variant="micro" tone="muted" numberOfLines={1}>{c.etaMinutes} min · {c.description}</Text>
                  </View>
                  {price != null ? <Money amount={price} variant="label" /> : <Skeleton width={56} height={18} />}
                </PressableScale>
              );
            })}
          </View>
          {selected ? (
            <PressableScale onPress={() => current && setShowFare(true)} accessibilityRole="button" accessibilityLabel={cq ? `${serviceName}, ${formatMoney(total)}, arrivée estimée ${selected.etaMinutes} min, ${formatDistance(cq.route.distanceMeters)}, ${formatDuration(cq.route.durationSeconds)}. Voir le détail du prix` : 'Calcul du prix'} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.mauveSoft, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line }} testID="fare-card" pressedScale={0.98}>
              {selected.icon === 'scooter' ? <ServiceIcon icon="scooter" size={72} /> : <Illustration source={selected.icon === 'premium' ? cars.plumSmall : cars.pearlSmall} aspect={aspect.carSmall} width={112} />}
              <View style={{ flex: 1, gap: 5 }}>
                <Text variant="label" weight="semibold">{serviceName}</Text>
                <Text variant="caption" tone="accent">Arrivée estimée · {selected.etaMinutes} min (démo)</Text>
                {current ? <Money amount={total} variant="title" style={{ fontSize: 28, lineHeight: 34 }} /> : <Skeleton width={100} height={32} />}
                <Text variant="caption" tone="muted" numeric>{cq ? `${formatDistance(cq.route.distanceMeters)} · ${formatDuration(cq.route.durationSeconds)}` : 'Calcul du prix…'}</Text>
                {selected.conditions?.length ? <Text variant="micro" tone="muted" testID="service-conditions">{selected.conditions.join(' · ')}</Text> : null}
                <Text variant="micro" tone="accent">Voir le détail du prix ›</Text>
              </View>
            </PressableScale>
          ) : null}

          {q?.conditions.dynamic ? (
            <StatusBanner
              compact
              tone="warning"
              icon={<TrendingUp size={16} color={colors.warning} />}
              title={`Demande élevée ${formatMultiplier(q.conditions.dynamic.multiplierBp)}`}
              message={`sans majoration ${formatMoney(q.breakdown.total - q.breakdown.dynamicSurcharge)} · prix garanti`}
              testID="dynamic-banner"
            />
          ) : null}

          <SegmentedControl
            options={[
              { value: 'now', label: 'Maintenant' },
              { value: 'schedule', label: 'Planifier' },
            ]}
            value={mode}
            onChange={setMode}
            testID="mode"
          />
          {mode === 'schedule' ? <SchedulePicker day={day} time={time} onDay={setDay} onTime={setTime} /> : null}

          <PressableScale onPress={() => setShowPay(true)} accessibilityRole="button" accessibilityLabel={`Paiement : ${pm?.label ?? 'à choisir'}. Changer`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: colors.background }} testID="payment-row" pressedScale={0.98}>
            {pm?.kind === 'card' ? <CreditCard size={20} color={colors.ink} /> : <Banknote size={20} color={colors.ink} />}
            <View style={{ flex: 1 }}>
              <Text variant="label" weight="semibold" numberOfLines={1}>{pm?.label ?? 'Moyen de paiement'}</Text>
              <Text variant="micro" tone="muted" numberOfLines={1}>{pm ? (pm.kind === 'cash' ? 'À régler à la fin du trajet' : 'Débitée à l’arrivée') : 'À choisir'}</Text>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </PressableScale>
        </ScrollView>
        <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 10, paddingTop: 6, gap: 6 }}>
          <Button label={confirmLabel} size="major" full loading={book.isPending} loadingLabel={mode === 'schedule' ? 'Enregistrement…' : 'Envoi de la demande…'} disabled={!current || !pm || (mode === 'schedule' && !time)} disabledReason={!pm ? 'Choisissez un moyen de paiement.' : undefined} onPress={() => book.run()} testID="confirm-booking" />
          <Text variant="micro" tone="muted" align="center">
            {mode === 'schedule' ? 'Recherche d’une chauffeuse 15 min avant le départ.' : q ? `Annulation gratuite ${Math.round(q.conditions.cancellation.graceSeconds / 60)} min après l’attribution, puis ${formatMoney(q.conditions.cancellation.feeAfterGrace)}.` : 'Le prix reste visible avant confirmation.'}
          </Text>
        </View>
      </View>

      <Sheet visible={showFare} onClose={() => setShowFare(false)} title="Détail du prix" subtitle={q ? `Tarifs ${cities.data?.find(c => c.id === q.cityId)?.name ?? q.cityId} · règles v${q.ruleVersion}` : undefined} testID="fare-sheet">
        {q ? <FareDetail q={q} /> : null}
      </Sheet>
      <Sheet visible={showPay} onClose={() => setShowPay(false)} title="Paiement" subtitle="Les moyens proposés dépendent de votre ville." testID="payment-sheet">
        <View style={{ gap: 12 }}>
          <ListGroup>
            {(methods.data ?? []).map((m) => (
              <ListRow
                key={m.id}
                testID={`pm-${m.last4 ?? m.kind}`}
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

function ServiceIcon({ icon, size = 40 }: { icon: ServiceCategory['icon']; size?: number }) {
  useTheme();
  const Icon = icon === 'scooter' ? Bike : icon === 'premium' ? Gem : Car;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Icon size={Math.round(size * 0.5)} color={colors.accent} />
    </View>
  );
}

function FareDetail({ q }: { q: Quote }) {
  useTheme();
  return (
    <View style={{ gap: 14 }}>
      <FareBreakdown fare={q.breakdown} distanceMeters={q.route.distanceMeters} durationSeconds={q.route.durationSeconds} dynamicReason={q.conditions.dynamic?.reason} />
      <StatusBanner tone="neutral" title="Prix garanti à la confirmation" message={`Ce prix est gelé pour votre course, même si les tarifs changent ensuite. Annulation : gratuite ${Math.round(q.conditions.cancellation.graceSeconds / 60)} min après l’attribution, ${formatMoney(q.conditions.cancellation.feeAfterGrace)} ensuite, ${formatMoney(q.conditions.cancellation.feeAfterArrival)} si la chauffeuse est arrivée.`} />
      {q.conditions.cityStatus === 'test' ? <StatusBanner tone="warning" title="Ville en test" message="Tarifs de test, configurables par l’équipe Naya." /> : null}
    </View>
  );
}
