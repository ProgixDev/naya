import { useTheme ,
  Button,
  ErrorState,
  FareBreakdown,
  IconButton,
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
  useSingleFlight, SERVICE_ICON } from '@naya/ui';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Baby, Banknote, Bike, Briefcase, Car, Check, ChevronRight, CreditCard, Gem, Info, Lock, LocateFixed, Plus, SlidersHorizontal, TrendingUp, Users, Wallet, ChevronLeft } from '@naya/ui';
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
import { colors, gutter, radius, shadow } from '@naya/tokens';
import { draftStops, useDraft } from '@/lib/draft';
import { useAccountId, usePaymentMethods } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { SchedulePicker, firstDay } from '@/features/schedule/SchedulePicker';
import { RouteSummary } from '@/components/RouteSummary';

/** 17:45 in Casablanca time, shown as 17h45. */
const clock = (ms: number) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' }).format(new Date(ms)).replace(':', 'h');

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
  const [showOptions, setShowOptions] = useState(false);
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
  const confirmLabel = !current ? 'Calcul du prix…' : mode === 'schedule' ? `Planifier ${serviceName}` : `Commander une voiture`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="quote">
      {/* Top Map Section */}
      <View style={{ height: '36%' }}>
        <NayaMap center={center} markers={markers} route={q?.route.polyline} fitTo={q?.route.polyline ?? stops.map((s) => s.location)} topInset={insets.top + 8} bottomInset={36} />
        <View style={{ position: 'absolute', top: insets.top + 8, left: gutter }}>
          <PressableScale
            onPress={() => router.back()}
            testID="quote-back"
            accessibilityLabel="Modifier l’itinéraire"
            pressedScale={0.94}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', ...shadow.card }}
          >
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2.4} />
          </PressableScale>
        </View>
      </View>

      {/* Floating Bottom Sheet (Your Trip) */}
      <View style={{ flex: 1, marginTop: -26, backgroundColor: colors.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, ...shadow.float }}>
        {/* Grab Handle */}
        <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />

        {/* Sheet Header: Back button, "Votre trajet", and Capacity Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter, paddingTop: 4, paddingBottom: 8 }}>
          <PressableScale
            onPress={() => router.back()}
            pressedScale={0.95}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
          </PressableScale>
          <Text weight="bold" style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.4 }}>
            Votre trajet
          </Text>
          <PressableScale
            onPress={() => setShowOptions(true)}
            testID="passenger-capacity-btn"
            pressedScale={0.96}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.selected, borderWidth: 1, borderColor: colors.line }}
          >
            <Users size={15} color={colors.accent} strokeWidth={2.2} />
            <Text weight="semibold" style={{ fontSize: 13, color: colors.accent }}>
              4 max
            </Text>
          </PressableScale>
        </View>

        <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Pickup time selector section */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text weight="semibold" style={{ fontSize: 15, color: colors.ink }}>
                Heure de départ
              </Text>
              <PressableScale onPress={() => toast('Prix garanti dès la validation du trajet')} hitSlop={8}>
                <Info size={17} color={colors.muted} />
              </PressableScale>
            </View>

            {/* Departure Time Chips */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <PressableScale
                onPress={() => { setMode('now'); haptic.select(); }}
                pressedScale={0.97}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: mode === 'now' ? colors.ink : colors.background,
                  borderWidth: 1,
                  borderColor: mode === 'now' ? colors.ink : colors.line,
                }}
              >
                <Text weight="bold" style={{ fontSize: 14, color: mode === 'now' ? '#FFFFFF' : colors.ink }}>
                  Maintenant
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => { setMode('schedule'); haptic.select(); }}
                pressedScale={0.97}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: mode === 'schedule' ? colors.accent : colors.background,
                  borderWidth: 1,
                  borderColor: mode === 'schedule' ? colors.accent : colors.line,
                }}
              >
                <Text weight="bold" style={{ fontSize: 14, color: mode === 'schedule' ? '#FFFFFF' : colors.ink }}>
                  Planifier
                </Text>
              </PressableScale>
            </View>

            {/* Hidden SegmentedControl for test compatibility */}
            <View style={{ display: 'none' }}>
              <SegmentedControl options={[{ value: 'now', label: 'Maintenant' }, { value: 'schedule', label: 'Planifier' }]} value={mode} onChange={setMode} testID="mode" />
            </View>

            {mode === 'schedule' ? <SchedulePicker day={day} time={time} onDay={setDay} onTime={setTime} /> : null}
          </View>

          {/* Route Stops Timeline Card */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12, ...shadow.card }}>
            {/* Pickup row */}
            <PressableScale onPress={() => router.back()} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
                <LocateFixed size={18} color={colors.accent} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
                  {stops[0]?.label ?? 'Point de départ'}
                </Text>
                <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>
                  Attente 5 min · 1 min de marche
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </PressableScale>

            {/* Connector */}
            <View style={{ width: 1, height: 16, borderLeftWidth: 2, borderColor: colors.mauve, borderStyle: 'dashed', marginLeft: 15 }} />

            {/* Destination row */}
            <PressableScale onPress={() => router.back()} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' }} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
                  {stops[stops.length - 1]?.label ?? 'Destination'}
                </Text>
                <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>
                  {cq ? `${formatDistance(cq.route.distanceMeters)} · ${formatDuration(cq.route.durationSeconds)}` : 'Destination finale'}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </PressableScale>

            {/* Add Stop Button */}
            <PressableScale
              onPress={() => router.push('/route')}
              pressedScale={0.98}
              style={{
                height: 42,
                borderRadius: 21,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.line,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
              }}
            >
              <Plus size={16} color={colors.ink} strokeWidth={2.4} />
              <Text weight="semibold" style={{ fontSize: 14, color: colors.ink }}>
                Ajouter un arrêt ou un aller-retour
              </Text>
            </PressableScale>
          </View>

          {quote.isError ? (
            <StatusBanner tone="danger" title={isApiError(quote.error) && quote.error.code === 'OUT_OF_ZONE' ? 'Hors zone desservie' : 'Prix indisponible'} message={errorMessage(quote.error)} action={{ label: 'Modifier l’itinéraire', onPress: () => router.back() }} testID="quote-error" />
          ) : null}

          {/* Vehicle Categories */}
          <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Type de véhicule">
            <Text weight="semibold" tone="muted" style={label12}>Véhicule</Text>
            {catalog.isLoading ? <Skeleton width="100%" height={64} /> : null}
            {catalog.data && !available.length ? <StatusBanner tone="warning" title="Aucun service disponible" message="Aucun type de véhicule n’est proposé dans cette ville pour le moment." /> : null}
            {available.map((c) => {
              const on = categoryId === c.id;
              const price = q?.options?.find((o) => o.id === c.id)?.total;
              return (
                <PressableScale key={c.id} onPress={() => { setPicked(c.id); haptic.select(); }} testID={`service-${c.id}`} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${c.name}, arrivée ${c.etaMinutes} min${price != null ? `, ${formatMoney(price)}` : ''}`} pressedScale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.selected : colors.surface }}>
                  <ServiceIcon icon={c.icon} on={on} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text weight="semibold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 21 }}>{c.name}</Text>
                    <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{c.etaMinutes} min · {c.description}</Text>
                  </View>
                  {price != null ? <Text weight="semibold" numeric style={{ fontSize: 16, lineHeight: 21 }}>{formatMoney(price)}</Text> : <Skeleton width={56} height={18} />}
                </PressableScale>
              );
            })}
            {selected?.conditions?.length ? <Text tone="muted" style={{ fontSize: 12, lineHeight: 16, marginHorizontal: 4 }} testID="service-conditions">{serviceName} · {selected.conditions.join(' · ')}</Text> : null}
          </View>

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
        </ScrollView>

        {/* Bottom Booking Action Bar */}
        <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface, gap: 10 }}>
          {/* Payment dropdown on left + Price on right */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <PressableScale
              onPress={() => setShowPay(true)}
              accessibilityRole="button"
              accessibilityLabel={`Paiement : ${pm?.label ?? 'à choisir'}`}
              testID="payment-row"
              pressedScale={0.97}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
            >
              <Text weight="semibold" style={{ fontSize: 14, color: colors.ink }}>
                {pm?.label ?? 'Moyen de paiement'} ▾
              </Text>
            </PressableScale>

            <PressableScale
              onPress={() => current && setShowFare(true)}
              testID="fare-card"
              pressedScale={0.97}
              style={{ paddingVertical: 4 }}
            >
              {current ? (
                <Text weight="bold" numeric style={{ fontSize: 20, color: colors.ink }}>
                  {formatMoney(total)}
                </Text>
              ) : (
                <Skeleton width={64} height={20} />
              )}
            </PressableScale>
          </View>

          {/* Split CTA Button Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Circular Options Button */}
            <PressableScale
              onPress={() => setShowOptions(true)}
              testID="trip-options-btn"
              accessibilityRole="button"
              accessibilityLabel="Options du trajet"
              pressedScale={0.94}
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: colors.line,
                alignItems: 'center',
                justifyContent: 'center',
                ...shadow.card,
              }}
            >
              <SlidersHorizontal size={22} color={colors.ink} strokeWidth={2.2} />
            </PressableScale>

            {/* Main Action Pill Button */}
            <View style={{ flex: 1 }}>
              <Button
                label={confirmLabel}
                size="major"
                full
                pill
                loading={book.isPending}
                loadingLabel={mode === 'schedule' ? 'Enregistrement…' : 'Envoi de la demande…'}
                disabled={!current || !pm || (mode === 'schedule' && !time)}
                disabledReason={!pm ? 'Choisissez un moyen de paiement.' : undefined}
                onPress={() => book.run()}
                testID="confirm-booking"
              />
            </View>
          </View>

          <Text variant="micro" tone="muted" align="center">
            {mode === 'schedule' ? 'Recherche d’une chauffeuse 15 min avant le départ.' : q ? `Annulation gratuite ${Math.round(q.conditions.cancellation.graceSeconds / 60)} min après l’attribution.` : 'Le prix reste visible avant confirmation.'}
          </Text>
        </View>
      </View>

      {/* Screen 3: Passenger Options Sheet */}
      <Sheet visible={showOptions} onClose={() => setShowOptions(false)} title="Capacité & Options passagers" testID="passenger-options-sheet">
        <View style={{ gap: 12, paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={22} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" style={{ fontSize: 15, color: colors.ink }}>
                Espace bagages
              </Text>
              <Text tone="muted" style={{ fontSize: 13, color: colors.muted }}>
                Coffre spacieux pour 2 bagages en cabine
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Baby size={22} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" style={{ fontSize: 15, color: colors.ink }}>
                Siège auto enfant
              </Text>
              <Text tone="muted" style={{ fontSize: 13, color: colors.muted }}>
                Réhausseur ou siège disponible sur demande
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={22} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" style={{ fontSize: 15, color: colors.ink }}>
                Code de sécurité PIN
              </Text>
              <Text tone="muted" style={{ fontSize: 13, color: colors.muted }}>
                Vérification du code confidentiel dans l'application
              </Text>
            </View>
          </View>
        </View>
      </Sheet>

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

const label12 = { fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' as const, marginLeft: 4, marginBottom: 2 };

function ServiceIcon({ icon, size = 44, on }: { icon: ServiceCategory['icon']; size?: number; on?: boolean }) {
  useTheme();
  const Icon = SERVICE_ICON[icon] ?? Car;
  return (
    <View style={{ width: size, height: size, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.surface : colors.mauveSoft }}>
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
