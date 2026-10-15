import {
  useTheme,
  Button,
  FareBreakdown,
  Icon,
  IconButton,
  Illustration,
  ListGroup,
  ListRow,
  Money,
  NayaMap,
  PressableScale,
  RouteStopRow,
  Sheet,
  Skeleton,
  StatusBanner,
  Text,
  haptic,
  paymentIcon,
  toast,
  useSingleFlight,
} from '@naya/ui';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bike, CalendarClock, Check, ChevronDown, Info, MapPin, Plus, TrendingUp } from 'lucide-react-native';
import {
  casablancaLocalToUtc,
  formatMoney,
  formatMultiplier,
  isInService,
  paymentMethodPresentation,
  walletAvailable,
  type PaymentIconName,
  type Place,
  type Quote,
} from '@naya/domain';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import { cars, aspect } from '@naya/assets';
import { colors, gutter, radius, shadow, themedStyles } from '@naya/tokens';
import { MAX_STOPS, draftStops, useDraft } from '@/lib/draft';
import { useAccountId, useCities, usePaymentMethods } from '@/lib/queries';
import { useCityId } from '@/lib/prefs';
import { SchedulePicker, firstDay, useCityScheduling, useScheduleLabel } from '@/features/schedule/SchedulePicker';

/** A service the passenger can choose here: the catalogue's category, or Naya Standard while the catalogue is unavailable. */
type ServiceOption = { id: string; name: string; description: string; etaMinutes: number; icon?: 'car' | 'scooter' | 'premium' };

/** « Rabat · Centre-ville » reads « Centre-ville » once the city is known. */
const shortLabel = (label: string) => label.replace(/^(Rabat|Casablanca) · /, '');
const short = (p: Place | null | undefined): Place | null => (p ? { ...p, label: shortLabel(p.label) } : null);

type EditParams = { slot: 'pickup' | 'destination' | 'stop' | 'newStop'; index?: string; pin?: '1' };

/**
 * P08 quote (redesign audit P-20 to P-24, R6). The route is edited here: every stop opens the address search,
 * which comes back to this screen. Each service shows its own server price, so the options compare at a glance
 * and the fare sits above the fold; the pinned footer holds when, how to pay and the commitment.
 */
export default function QuoteScreen() {
  useTheme();
  const params = useLocalSearchParams<{ schedule?: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  // Large text grows the pinned footer: give it the map's height so Confirm stays on screen (VIS-03).
  const { fontScale } = useWindowDimensions();
  const draft = useDraft();
  const cityId = useCityId(); // the server's user.cityId (ADR-0054, PAX-05)
  const cities = useCities();
  const city = cities.data?.find((c) => c.id === cityId);
  const stops = draftStops(draft);
  const stopsKey = JSON.stringify(stops?.map((s) => [s.label, s.location.lat, s.location.lng]));

  const outOfZone = useMemo(() => {
    if (!city) return [] as string[];
    return [draft.pickup, ...draft.stops, draft.destination].filter((p): p is Place => !!p && !isInService(p.location, city.zones)).map((p) => shortLabel(p.label));
  }, [city, draft.pickup, draft.stops, draft.destination]);

  // Services offered in this city (PAX-08: never start on a category the city does not offer).
  const catalog = useQuery({ queryKey: ['naya', a, 'catalog'], queryFn: api.prototype.catalog });
  const options: ServiceOption[] = useMemo(() => {
    const offered = catalog.data?.categories.filter((c) => c.enabled && (!c.cityIds.length || c.cityIds.includes(cityId))) ?? [];
    if (offered.length) return offered;
    return catalog.isError ? [{ id: 'standard', name: 'Naya Standard', description: '', etaMinutes: 5 }] : [];
  }, [catalog.data, catalog.isError, cityId]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const selectedId = categoryId && options.some((o) => o.id === categoryId) ? categoryId : (options.find((o) => o.id === 'standard') ?? options[0])?.id;

  // One server quote per service, so every option shows its own price (P-20). Quotes are single-use and never cached.
  const quotes = useQueries({
    queries: options.map((o) => ({
      queryKey: ['naya', a, 'quote', cityId, stopsKey, o.id],
      queryFn: () => api.quotes.create(cityId, stops!, o.id),
      enabled: !!stops && outOfZone.length === 0,
      staleTime: Infinity,
      gcTime: 0,
      retry: false,
    })),
  });
  const selectedIndex = options.findIndex((o) => o.id === selectedId);
  const quote = selectedIndex >= 0 ? quotes[selectedIndex] : undefined;
  const q = quote?.data;
  const service = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const serviceName = q?.service?.name ?? service?.name ?? 'Naya Standard';

  const methods = usePaymentMethods();
  const rules = useCityScheduling();
  const [mode, setMode] = useState<'now' | 'schedule'>(params.schedule ? 'schedule' : 'now');
  const [pmId, setPmId] = useState<string | null>(null);
  const [showFare, setShowFare] = useState(false);
  const [showPay, setShowPay] = useState(false);
  // « Plus tard » from home lands here with the day and time to choose first.
  const [showWhen, setShowWhen] = useState(!!params.schedule);
  const deadline = useDeadline(q?.expiresAt);
  const [day, setDay] = useState(firstDay());
  const [time, setTime] = useState<string | null>(null);
  const scheduleLabel = useScheduleLabel(day, time);

  // Quotes are valid 10 minutes. On expiry fresh quotes are fetched and shown before any commitment.
  useEffect(() => {
    if (deadline.expired && q) {
      quotes.forEach((x) => void x.refetch());
      toast('Le prix a été recalculé');
    }
  }, [deadline.expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const pm = methods.data?.find((m) => m.id === pmId && m.availableInCity) ?? methods.data?.find((m) => m.isDefault && m.availableInCity) ?? methods.data?.find((m) => m.availableInCity);
  // The wallet holds the frozen total at booking (and at scheduling): show what it can still pay.
  // Same key as the Portefeuille Naya screen (packages/ui PassengerWalletScreen), so both share the cache.
  const hasWallet = !!methods.data?.some((m) => m.kind === 'wallet' && m.availableInCity);
  const wallet = useQuery({ queryKey: ['naya', a, 'passenger-wallet'], queryFn: api.prototype.wallet, enabled: hasWallet });
  const available = wallet.data ? walletAvailable(wallet.data) : null;
  const pres = pm ? paymentMethodPresentation(pm) : null;
  const walletShort = !!q && pm?.kind === 'wallet' && available !== null && available < q.breakdown.total;
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
        qc.removeQueries({ queryKey: ['naya', a, 'quote'] });
        qc.invalidateQueries({ queryKey: qk.activeRide(a) });
        qc.invalidateQueries({ queryKey: qk.scheduled(a) });
        // A wallet booking puts a hold on the balance: the next quote must not read the old figure.
        qc.invalidateQueries({ queryKey: ['naya', a, 'passenger-wallet'] });
        // Replace: the stack is [home, quote], so back from the ride or the booking returns home (PAX-15).
        if (r.kind === 'ride') router.replace('/ride');
        else {
          toast('Réservation enregistrée', 'success');
          router.replace({ pathname: '/scheduled/[id]', params: { id: r.result.id } });
        }
      },
      onError: (e) => {
        haptic.error();
        if (isApiError(e) && (e.code === 'QUOTE_EXPIRED' || (e.code === 'CONFLICT' && /devis/.test(e.message)))) {
          void quote?.refetch();
          book.reset();
        }
        if (isApiError(e) && e.code === 'ACTIVE_RIDE_EXISTS') router.replace('/ride');
        toast(errorMessage(e), 'danger');
      },
    },
  );

  const edit = (p: EditParams) => router.push({ pathname: '/route', params: { ...p, from: 'quote' } });
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const fallbackCenter = city?.center ?? { lat: 34.0189, lng: -6.8367 };
  const center = (draft.pickup ?? draft.destination)?.location ?? fallbackCenter;
  const markers = (stops ?? [draft.pickup, draft.destination].filter((p): p is Place => !!p)).map((s, i, all) => ({ id: `s${i}`, kind: (i === 0 ? 'pickup' : i === all.length - 1 ? 'destination' : 'stop') as 'pickup' | 'stop' | 'destination', coordinate: s.location, label: shortLabel(s.label) }));
  const total = q?.breakdown.total ?? 0;
  const verb = mode === 'schedule' ? 'Planifier' : 'Confirmer';
  const confirmLabel = q ? `${verb} ${serviceName} · ${formatMoney(total)}` : verb;
  const blocked = !stops ? 'Choisissez un départ et une destination.' : outOfZone.length ? 'Une adresse est hors zone.' : !pm ? 'Choisissez un moyen de paiement.' : mode === 'schedule' && !time ? 'Choisissez un horaire.' : undefined;
  const whenLabel = mode === 'schedule' ? (scheduleLabel ?? 'Choisir l’horaire') : 'Maintenant';
  const quoteError = quote?.isError && outOfZone.length === 0 ? quote.error : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="quote">
      <View style={{ height: fontScale > 1.3 ? '20%' : '28%' }}>
        <NayaMap center={center} markers={markers} route={q?.route.polyline} fitTo={q?.route.polyline ?? markers.map((m) => m.coordinate)} topInset={insets.top + 8} bottomInset={36} />
        <View style={{ position: 'absolute', top: insets.top + 8, left: gutter }}>
          <IconButton icon={<ArrowLeft size={22} color={colors.ink} />} accessibilityLabel="Retour" onPress={leave} testID="quote-back" />
        </View>
      </View>
      <View style={styles.sheet}>
        <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
          {/* The route is the screen's title, and each line edits itself (P-21, R6). */}
          <View style={styles.route} accessibilityRole="summary" accessibilityLabel="Itinéraire" testID="quote-route">
            <RouteStopRow compact role="pickup" place={short(draft.pickup)} placeholder="Choisir le départ" onPress={() => edit({ slot: 'pickup' })} testID="stop-pickup" />
            {draft.stops.map((s, i) => (
              <RouteStopRow
                key={`${s.label}-${i}`}
                compact
                role="stop"
                place={short(s)}
                onPress={() => edit({ slot: 'stop', index: String(i) })}
                onRemove={() => draft.removeStop(i)}
                onMoveUp={i > 0 ? () => draft.moveStop(i, -1) : undefined}
                onMoveDown={i < draft.stops.length - 1 ? () => draft.moveStop(i, 1) : undefined}
                testID={`stop-${i}`}
              />
            ))}
            <RouteStopRow compact role="destination" place={short(draft.destination)} placeholder="Choisir la destination" onPress={() => edit({ slot: 'destination' })} isLast testID="stop-destination" />
          </View>
          {/* PAX-17: a pickup the passenger never chose is said, not hidden. */}
          {draft.pickup && draft.pickupSource === 'default' ? <StatusBanner compact tone="warning" icon={<Icon name="circle-alert" tone="warning" size={16} scale={false} />} title="Départ par défaut" message="touchez « Départ » pour le préciser" testID="pickup-default" /> : null}
          {outOfZone.length ? <StatusBanner compact tone="danger" title="Hors zone" message={`${outOfZone.join(', ')} · choisissez une adresse dans la zone ${city?.name ?? ''}`} testID="out-of-zone" /> : null}
          {quoteError ? (
            <StatusBanner
              tone="danger"
              title={isApiError(quoteError) && quoteError.code === 'OUT_OF_ZONE' ? 'Hors zone desservie' : 'Prix indisponible'}
              message={errorMessage(quoteError)}
              action={{ label: 'Réessayer', onPress: () => void quote?.refetch() }}
              testID="quote-error"
            />
          ) : null}

          <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Service">
            {options.length
              ? options.map((o, i) => (
                  <OptionRow
                    key={o.id}
                    option={o}
                    quote={quotes[i]?.data}
                    pending={!!stops && outOfZone.length === 0 && !!quotes[i]?.isFetching}
                    failed={!!quotes[i]?.isError}
                    selected={o.id === selectedId}
                    onSelect={() => setCategoryId(o.id)}
                    onDetail={() => quotes[i]?.data && setShowFare(true)}
                  />
                ))
              : [0, 1].map((k) => <Skeleton key={k} height={72} radius={radius.row} />)}
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

          {/* P-19: route actions as rows, after the prices. */}
          <ListGroup>
            {draft.stops.length < MAX_STOPS ? <ListRow title="Ajouter un arrêt" leading={<Icon icon={Plus} size={24} />} onPress={draft.destination ? () => edit({ slot: 'newStop' }) : undefined} testID="add-stop" /> : null}
            <ListRow title="Départ sur la carte" leading={<Icon icon={MapPin} size={24} />} onPress={() => edit({ slot: 'pickup', pin: '1' })} testID="pin-pickup" />
          </ListGroup>
          {draft.stops.length >= MAX_STOPS ? (
            <Text variant="caption" tone="muted" testID="max-stops">Deux arrêts maximum : retirez-en un pour en ajouter un autre.</Text>
          ) : draft.stops.length > 1 ? (
            <Text variant="caption" tone="muted">Changez l’ordre avec les flèches ; le prix est recalculé ensuite.</Text>
          ) : null}
        </ScrollView>

        {/* P-22, VIS-03: when, how to pay and the commitment stay pinned, whatever the services or text size. */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]} testID="quote-footer">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <PressableScale onPress={() => setShowWhen(true)} accessibilityRole="button" accessibilityLabel={`Départ : ${whenLabel}. Changer`} style={styles.pill} testID="when-chip" pressedScale={0.98}>
              {mode === 'schedule' ? <Icon icon={CalendarClock} size={16} /> : null}
              <Text variant="label" weight="semibold" numberOfLines={1}>{whenLabel}</Text>
              <ChevronDown size={16} color={colors.muted} />
            </PressableScale>
            <PaymentRow
              // Short enough to sit beside the « when » chip: the card's last digits, the method's short name otherwise.
              title={!pres ? 'Moyen de paiement' : pres.kind === 'card' && pm?.last4 ? `•• ${pm.last4}` : pres.shortLabel}
              detail={pres ? `${pres.label}, ${pres.usesBalance && available !== null ? `${formatMoney(available)} disponibles, ` : ''}${pres.timing}` : 'À choisir'}
              icon={pres?.icon ?? 'banknote'}
              warn={walletShort}
              onPress={() => setShowPay(true)}
            />
          </View>
          {walletShort && q && available !== null ? (
            <PressableScale onPress={() => router.push('/wallet')} accessibilityRole="button" accessibilityLabel={`Solde insuffisant : ${formatMoney(available)} disponibles pour ${formatMoney(q.breakdown.total)}. Recharger le portefeuille`} pressedScale={0.98} testID="wallet-short">
              <StatusBanner compact tone="warning" title="Solde insuffisant" message={`il manque ${formatMoney(q.breakdown.total - available)} · Recharger ›`} />
            </PressableScale>
          ) : null}

          <Button
            label={confirmLabel}
            size="major"
            full
            loading={book.isPending}
            loadingLabel={mode === 'schedule' ? 'Enregistrement…' : 'Envoi de la demande…'}
            disabled={!!blocked || !q || walletShort}
            disabledReason={blocked}
            accessibilityHint={walletShort ? 'Solde insuffisant. Rechargez ou choisissez un autre moyen.' : undefined}
            onPress={() => book.run()}
            testID="confirm-booking"
          />
          <Text variant="micro" tone="muted" align="center" numberOfLines={2}>
            {mode === 'schedule' ? 'Recherche d’une chauffeuse 15 min avant le départ.' : q ? `Annulation gratuite ${Math.round(q.conditions.cancellation.graceSeconds / 60)} min après l’attribution, puis ${formatMoney(q.conditions.cancellation.feeAfterGrace)}.` : 'Le prix reste visible avant confirmation.'}
          </Text>
        </View>
      </View>

      <Sheet
        visible={showWhen}
        onClose={() => setShowWhen(false)}
        title="Départ"
        testID="when-sheet"
        footer={mode === 'schedule' ? <Button label={scheduleLabel ? `Valider · ${scheduleLabel}` : 'Valider'} full disabled={!time} onPress={() => setShowWhen(false)} testID="when-done" /> : undefined}
      >
        <View style={{ gap: 16 }}>
          <ListGroup>
            <ListRow title="Maintenant" subtitle="Recherche d’une chauffeuse dès la confirmation" selected={mode === 'now'} onPress={() => { setMode('now'); setShowWhen(false); }} testID="mode-now" />
            <ListRow title="Planifier" subtitle={`Jusqu’à ${rules.maxDaysAhead} jours à l’avance`} selected={mode === 'schedule'} onPress={() => setMode('schedule')} testID="mode-schedule" />
          </ListGroup>
          {mode === 'schedule' ? <SchedulePicker day={day} time={time} onDay={setDay} onTime={setTime} onChosen={() => setShowWhen(false)} /> : null}
        </View>
      </Sheet>
      <Sheet visible={showFare} onClose={() => setShowFare(false)} title="Détail du prix" subtitle={q ? `${serviceName} · tarifs ${cities.data?.find((c) => c.id === q.cityId)?.name ?? q.cityId}` : undefined} testID="fare-sheet">
        {q ? <FareDetail q={q} /> : null}
      </Sheet>
      <Sheet visible={showPay} onClose={() => setShowPay(false)} title="Paiement" subtitle="Les moyens proposés dépendent de votre ville." testID="payment-sheet">
        <View style={{ gap: 12 }}>
          <ListGroup>
            {(methods.data ?? []).map((m) => {
              const p = paymentMethodPresentation(m);
              // P-24: a wallet that cannot pay this fare is not a choice; its row leads to the top-up.
              const short = !!q && m.kind === 'wallet' && available !== null && available < q.breakdown.total;
              const subtitle = !m.availableInCity ? 'Indisponible dans cette ville' : short ? `Solde insuffisant · ${formatMoney(available ?? 0)} disponibles` : p.usesBalance && available !== null ? `${formatMoney(available)} disponibles · ${p.timing}` : p.timing;
              const leading = <Icon icon={paymentIcon(p.icon)} size={24} color={m.availableInCity && !short ? colors.ink : colors.muted} />;
              const testID = `pm-${m.last4 ?? m.kind}`;
              if (!m.availableInCity) return <ListRow key={m.id} testID={testID} title={p.label} subtitle={subtitle} leading={leading} />;
              if (short) return <ListRow key={m.id} testID={testID} title={p.label} subtitle={subtitle} leading={leading} accessibilityHint="Recharger le portefeuille" onPress={() => { setShowPay(false); router.push('/wallet'); }} />;
              return (
                <ListRow
                  key={m.id}
                  testID={testID}
                  title={p.label}
                  subtitle={subtitle}
                  leading={leading}
                  selected={m.id === pm?.id}
                  onPress={() => { setPmId(m.id); setShowPay(false); }}
                />
              );
            })}
          </ListGroup>
          {hasWallet ? <Button label="Recharger mon portefeuille" variant="secondary" full onPress={() => { setShowPay(false); router.push('/wallet'); }} testID="pay-sheet-topup" /> : null}
          <Button label="Gérer mes moyens de paiement" variant="ghost" full onPress={() => { setShowPay(false); router.push('/payments'); }} />
        </View>
      </Sheet>
    </View>
  );
}

/**
 * P-20: one full-width service row of 72: vehicle, name, « 5 min · … », and its price on the right. Selected is a
 * 2-pt accent outline plus a check; tapping the selected row opens the price detail (testID `fare-card`).
 */
function OptionRow({ option, quote, pending, failed, selected, onSelect, onDetail }: { option: ServiceOption; quote?: Quote; pending: boolean; failed: boolean; selected: boolean; onSelect: () => void; onDetail: () => void }) {
  useTheme();
  const name = quote?.service?.name ?? option.name;
  const eta = quote?.service?.etaMinutes ?? option.etaMinutes;
  const price = quote?.breakdown.total;
  const a11y = [name, `arrivée estimée ${eta} min`, price !== undefined ? formatMoney(price) : failed ? 'prix indisponible' : 'calcul du prix'].join(', ');
  return (
    <View testID={`service-${option.id}`}>
      <PressableScale
        testID={selected ? 'fare-card' : undefined}
        onPress={() => {
          if (selected) onDetail();
          else {
            haptic.select();
            onSelect();
          }
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, selected }}
        aria-selected={selected}
        accessibilityLabel={a11y}
        accessibilityHint={selected && price !== undefined ? 'Touchez pour voir le détail du prix' : undefined}
        pressedScale={0.985}
        style={[styles.option, selected ? styles.optionSelected : null]}
      >
        {/* The vehicle says which service; a scooter is not drawn as a car. */}
        <View style={styles.vehicle}>{option.icon === 'scooter' ? <Icon icon={Bike} size={28} scale={false} /> : <Illustration source={cars.pearlSmall} aspect={aspect.carSmall} width={48} />}</View>
        <View style={{ flex: 1, gap: 2 }}>
          {/* Two lines: at large text sizes « Naya Scooter » and « Naya Standard » must stay distinct. */}
          <Text variant="bodyStrong" weight="semibold" numberOfLines={2}>{name}</Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {option.description ? `${eta} min · ${option.description}` : `${eta} min`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {price !== undefined ? (
            <Money amount={price} variant="bodyStrong" />
          ) : pending ? (
            <Skeleton width={72} height={18} />
          ) : (
            <Text variant="caption" tone="muted">{failed ? 'Indisponible' : '—'}</Text>
          )}
          {selected && price !== undefined ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Info size={13} color={colors.muted} />
              <Text variant="caption" tone="muted">Détail</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.check}>{selected ? <Check size={20} strokeWidth={2.4} color={colors.accent} /> : null}</View>
      </PressableScale>
    </View>
  );
}

/** The chosen method, pinned next to Confirm: a 44 control with a visible outline in both schemes. */
function PaymentRow({ title, detail, icon, warn, onPress }: { title: string; detail: string; icon: PaymentIconName; warn: boolean; onPress: () => void }) {
  useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Paiement : ${detail}. Changer`} style={[styles.pill, { flexGrow: 1, borderColor: warn ? colors.warning : colors.outline }]} testID="payment-row" pressedScale={0.98}>
      <Icon icon={paymentIcon(icon)} size={20} />
      <Text variant="label" weight="semibold" numberOfLines={1} style={{ flexGrow: 1 }}>{title}</Text>
      <ChevronDown size={16} color={colors.muted} />
    </PressableScale>
  );
}

function FareDetail({ q }: { q: Quote }) {
  useTheme();
  return (
    <View style={{ gap: 14 }}>
      <FareBreakdown fare={q.breakdown} distanceMeters={q.route.distanceMeters} durationSeconds={q.route.durationSeconds} dynamicReason={q.conditions.dynamic?.reason} />
      <StatusBanner tone="neutral" title="Prix garanti à la confirmation" message={`Ce prix est gelé pour votre course, même si les tarifs changent ensuite. Annulation : gratuite ${Math.round(q.conditions.cancellation.graceSeconds / 60)} min après l’attribution, ${formatMoney(q.conditions.cancellation.feeAfterGrace)} ensuite, ${formatMoney(q.conditions.cancellation.feeAfterArrival)} si la chauffeuse est arrivée.`} />
      {q.conditions.cityStatus === 'test' ? <StatusBanner kind="city" state="test" title="Ville en test" message="Tarifs de test, configurables par l’équipe Naya." /> : null}
    </View>
  );
}

// themedStyles: read per render, so the quote follows light and dark mode.
const styles = themedStyles(() => ({
  sheet: { flex: 1, marginTop: -28, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, ...shadow.float },
  route: { borderRadius: radius.row, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: 12, paddingVertical: 2 },
  option: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 72, paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.row, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface },
  // 2-pt outline; the padding drops by the extra point so nothing moves when the selection changes.
  optionSelected: { borderWidth: 2, borderColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8 },
  check: { width: 20, alignItems: 'center' as const },
  vehicle: { width: 48, alignItems: 'center' as const },
  footer: { paddingHorizontal: gutter, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, minHeight: 44, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 22, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface },
}));
