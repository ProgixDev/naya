import { useMemo, useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Check, ChevronRight, Clock, Droplets, House, ImageOff, LocateFixed, MapPin, Star, X } from 'lucide-react-native';
import { errorMessage, isApiError, qk, serverClock } from '@naya/api';
import { useApi } from '@naya/api/react';
import {
  casablancaLocalToUtc,
  formatDateTime,
  formatMoney,
  formatShort,
  formatTime,
  isInService,
  isWashOpen,
  PAYMENT_STATUS_LABELS,
  statusPresentation,
  toCasablancaParts,
  washEndAt,
  washSlots,
  WASH_CANCEL_REASONS,
  WASH_PROGRESS,
  WASH_STATUS_LABELS,
  type CancelInput,
  type LatLng,
  type Place,
  type SavedPlace,
  type ServiceZone,
  type CreateWashOrderInput,
  type Vehicle,
  type WashOrder,
  type WashPackageId,
  type WashPhoto,
  type WashCar,
  type WashPaymentOption,
  type WashScheduling,
  type WashTiming,
} from '@naya/domain';
import { mockPhotos, mockPhotoAspect } from '@naya/assets';
import { colors, gutter, radius, shadow, themedStyles } from '@naya/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../core/theme';
import { useSingleFlight } from '../core/useSingleFlight';
import { Screen, Section } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button, IconButton, TextButton } from '../Button';
import { FieldRow, FormField, Pill } from '../Form';
import { EmptyState, ErrorState, Skeleton, SkeletonList, StatusBanner } from '../Feedback';
import { Card, IconDisc, ListGroup, ListRow } from '../List';
import { Sheet } from '../BottomSheet';
import { SegmentedControl } from '../SegmentedControl';
import { PressableScale } from '../PressableScale';
import { Money } from '../Ride';
import { toast } from '../Toast';
import { haptic } from '../haptics';
import { NayaMap } from '../map';
import { Icon } from '../Icon';
import { StatusIcon } from '../StatusIcon';
import { washPaymentIcon } from '../paymentIcons';
import { Avatar } from '../Brand';

/**
 * « Lavage à domicile », shared by the passenger and driver apps. Route files stay thin:
 * they pass the account, the role and what only the app knows (saved places, vehicle,
 * how to read the phone's position). The washing team is played by the mock backend; its
 * before/after shots come from @naya/assets `mockPhotos` until the team uploads real ones.
 *
 * States follow the shared status map (redesign audit C15): a glyph alone in the order rows, the
 * full sentence as the order screen's title, and the word always in the accessibility label (R1).
 */

/** Same shortcuts as the driver's vehicle sign-up step (P-53). */
const MAKES = ['Dacia', 'Renault', 'Peugeot', 'Hyundai', 'Toyota', 'Kia'];
const COLOURS = ['Blanc', 'Gris', 'Noir', 'Bleu', 'Rouge', 'Beige'];

/* ───────────── Entry card (home) ───────────── */

/** Secondary service card for the home screens. Kept to one compact row so the ride flow stays first. */
export function CarWashEntry({ onPress, testID = 'car-wash-entry' }: { onPress: () => void; testID?: string }) {
  useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Lavage à domicile. Votre voiture lavée sur place." style={styles.entry} testID={testID} pressedScale={0.985}>
      <IconDisc tone="accent" size={40}>
        <Icon icon={Droplets} size={20} color={colors.accent} scale={false} />
      </IconDisc>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="label" weight="semibold" numberOfLines={1}>
          Lavage à domicile
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          Votre voiture lavée sur place
        </Text>
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </PressableScale>
  );
}

/* ───────────── Orders list ───────────── */

export function CarWashOrdersScreen({ accountId, onBack, onNew, onOpen }: { accountId: string; onBack: () => void; onNew: () => void; onOpen: (id: string) => void }) {
  useTheme();
  const api = useApi();
  const orders = useQuery({
    queryKey: qk.carWashOrders(accountId),
    queryFn: api.carWash.list,
    refetchInterval: (q) => (q.state.data?.some((o) => isWashOpen(o.status)) ? 5000 : false),
  });
  const open = orders.data?.filter((o) => isWashOpen(o.status)) ?? [];
  const past = orders.data?.filter((o) => !isWashOpen(o.status)) ?? [];
  return (
    <Screen
      header={<Header title="Lavage à domicile" subtitle="Une équipe vient laver votre voiture là où elle est garée." onBack={onBack} />}
      footer={<Button label="Commander un lavage" size="major" full onPress={onNew} testID="car-wash-new" />}
      testID="car-wash-orders"
    >
      <View style={{ gap: 16 }}>
        {orders.isLoading ? <SkeletonList rows={2} /> : null}
        {orders.isError ? <ErrorState onRetry={() => orders.refetch()} /> : null}
        {orders.data && !orders.data.length ? <EmptyState title="Aucun lavage pour le moment" message="Choisissez l’endroit, la formule et le créneau : l’équipe vient à votre voiture." /> : null}
        {open.length ? (
          <ListGroup label="En cours et à venir">
            {open.map((o) => (
              <OrderRow key={o.id} order={o} onPress={() => onOpen(o.id)} />
            ))}
          </ListGroup>
        ) : null}
        {past.length ? (
          <ListGroup label="Historique">
            {past.map((o) => (
              <OrderRow key={o.id} order={o} onPress={() => onOpen(o.id)} />
            ))}
          </ListGroup>
        ) : null}
      </View>
    </Screen>
  );
}

/** One signal per row (principle 7): the state's glyph alone; its sentence is read with the row (R1). */
function OrderRow({ order, onPress }: { order: WashOrder; onPress: () => void }) {
  return (
    <ListRow
      testID={`car-wash-order-${order.id}`}
      title={`${order.terms.packageName} · ${order.car.make} ${order.car.model}`}
      subtitle={`${formatShort(order.startAt)} · ${order.location.label}`}
      status={{ kind: 'wash', state: order.status }}
      onPress={onPress}
    />
  );
}

const savedPlaceIcon = (kind: SavedPlace['kind']) => (kind === 'home' ? House : kind === 'work' ? Briefcase : Star);

/* ───────────── Booking ───────────── */

const STEPS = ['Où est la voiture ?', 'La voiture', 'La formule', 'Quand ?', 'Paiement'] as const;
const weekday = new Intl.DateTimeFormat('fr-MA', { weekday: 'short', day: 'numeric', timeZone: 'Africa/Casablanca' });
const hhmm = (t: string) => t.replace(':', 'h');

/**
 * Why « Maintenant » cannot be ordered at this moment, or null when it can (CW-04). Same rule as the
 * server (services/demo-api carWash.ts): the team arrives after the ETA, in Rabat time, and the wash
 * must end by closing time.
 */
function nowUnavailable(cat: { nowEtaMinutes: number; scheduling: WashScheduling }, durationMinutes: number, nowMs: number): string | null {
  const start = new Date(nowMs + cat.nowEtaMinutes * 60_000).toISOString();
  const local = toCasablancaParts(start).time;
  const end = toCasablancaParts(washEndAt(start, durationMinutes)).time;
  const { openingTime, closingTime } = cat.scheduling;
  if (local >= openingTime && end <= closingTime && end >= local) return null;
  const hours = `Les équipes passent de ${hhmm(openingTime)} à ${hhmm(closingTime)}`;
  const clock = toCasablancaParts(new Date(nowMs).toISOString()).time;
  return clock >= openingTime && clock < closingTime ? `${hours} : un lavage commandé maintenant finirait trop tard.` : `${hours}.`;
}

/** What a wallet can spend now, in centimes; null for the other methods. Sent by the server with each wallet option. */
function walletBalance(o: WashPaymentOption): number | null {
  const balance = (o as WashPaymentOption & { balance?: unknown }).balance;
  return typeof balance === 'number' ? balance : null;
}

/** A wallet is offered only when it covers the price (CW-M3); the other methods follow the server. */
function canPayWith(o: WashPaymentOption, price: number | undefined): boolean {
  const balance = walletBalance(o);
  return o.available && (balance === null || price === undefined || balance >= price);
}

export interface CarWashBookingProps {
  accountId: string;
  role: 'passenger' | 'driver';
  cityId: string;
  savedPlaces?: SavedPlace[];
  /** Driver: her Naya vehicle, used to prefill the car. */
  vehicle?: Vehicle | null;
  /** Reads the phone's position (app-owned, so each app keeps its own location policy). */
  locate?: () => Promise<LatLng | null>;
  onBack: () => void;
  onBooked: (orderId: string) => void;
}

export function CarWashBookingScreen({ accountId, role, cityId, savedPlaces = [], vehicle = null, locate, onBack, onBooked }: CarWashBookingProps) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: qk.carWashCatalog(accountId, cityId), queryFn: () => api.carWash.catalog(cityId) });
  const payOptions = useQuery({ queryKey: qk.carWashPaymentOptions(accountId, cityId), queryFn: () => api.carWash.paymentOptions(cityId) });
  const cities = useQuery({ queryKey: qk.cities(), queryFn: api.cities.list, staleTime: 60_000 });
  const zones = cities.data?.find((c) => c.id === cityId)?.zones ?? [];
  const center = cities.data?.find((c) => c.id === cityId)?.center ?? { lat: 34.0189, lng: -6.8367 };

  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState('');
  // Untouched, the car follows the driver's vehicle file (which may load after the screen).
  const [carDraft, setCar] = useState<WashCar | null>(null);
  const car = carDraft ?? { make: vehicle?.make ?? '', model: vehicle?.model ?? '', color: vehicle?.color ?? '', plate: vehicle?.plate ?? '' };
  const [packageId, setPackageId] = useState<WashPackageId>('exterior');
  const [timingPick, setTiming] = useState<WashTiming>('now');
  const [pickedDay, setDay] = useState<string | null>(null);
  const [pickedTime, setTime] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const cat = catalog.data?.available ? catalog.data : null;
  const pkg = cat?.packages.find((p) => p.id === packageId) ?? cat?.packages[0];
  const nowMs = serverClock.now();
  const days = useMemo(() => {
    const now = serverClock.now();
    return Array.from({ length: cat?.scheduling.maxDaysAhead ?? 7 }, (_, i) => {
      const iso = new Date(now + i * 86_400_000).toISOString();
      return { date: toCasablancaParts(iso).date, label: i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : weekday.format(new Date(iso)) };
    });
  }, [cat?.scheduling.maxDaysAhead]);
  const slotsOn = (date: string) => (cat && pkg ? washSlots(cat.scheduling, pkg.durationMinutes, date, nowMs) : []);
  // Untouched, the day is the first one with a free slot (late in the evening, that is tomorrow).
  const firstOpenDay = days.find((d) => slotsOn(d.date).length > 0);
  const day = pickedDay ?? firstOpenDay?.date ?? days[0]?.date ?? toCasablancaParts(new Date(nowMs).toISOString()).date;
  const slots = slotsOn(day);
  // A slot that no longer fits (other day, longer package) falls back to the first one offered.
  const time = pickedTime && slots.includes(pickedTime) ? pickedTime : (slots[0] ?? null);
  // Outside the teams' hours « Maintenant » is refused here, not at the final confirm (CW-04): the next slot is preselected.
  const nowClosed = cat && pkg ? nowUnavailable(cat, pkg.durationMinutes, nowMs) : null;
  const timing: WashTiming = nowClosed ? 'scheduled' : timingPick;
  const firstSlot = firstOpenDay ? `${firstOpenDay.label === 'Aujourd’hui' || firstOpenDay.label === 'Demain' ? firstOpenDay.label.toLowerCase() : firstOpenDay.label} à ${hhmm(slotsOn(firstOpenDay.date)[0]!)}` : null;

  const usable = (o: WashPaymentOption) => canPayWith(o, pkg?.price);
  const option = payOptions.data?.find((o) => o.id === paymentId && usable(o)) ?? payOptions.data?.find((o) => o.isDefault && usable(o)) ?? payOptions.data?.find(usable);
  const carComplete = car.make.trim() && car.model.trim() && car.color.trim() && car.plate.trim().length >= 2;
  const inZone = place ? isInService(place.location, zones) || !zones.length : false;
  const vehicleId = role === 'driver' && vehicle && car.plate.trim() === vehicle.plate ? vehicle.id : null;

  // The order is the mutation's variables: useSingleFlight keeps one Idempotency-Key per intent and
  // makes a new one when what she orders changes (ADR-0053).
  const draftOrder = (): CreateWashOrderInput | null =>
    place && pkg && option
      ? {
          cityId,
          location: place,
          parkingNotes: notes.trim(),
          car: { make: car.make.trim(), model: car.model.trim(), color: car.color.trim(), plate: car.plate.trim().toUpperCase() },
          vehicleId,
          packageId: pkg.id,
          expectedPrice: pkg.price,
          timing,
          startAt: timing === 'scheduled' && time ? casablancaLocalToUtc(day, time) : null,
          paymentMethodId: option.id,
        }
      : null;
  const book = useSingleFlight(
    (input: CreateWashOrderInput, key: string) => api.carWash.create(input, key),
    {
      onSuccess: (order) => {
        haptic.success();
        qc.invalidateQueries({ queryKey: qk.carWashOrders(accountId) });
        qc.invalidateQueries({ queryKey: qk.carWashPaymentOptions(accountId, cityId) });
        if (role === 'driver') qc.invalidateQueries({ queryKey: qk.wallet(accountId) });
        toast('Lavage réservé', 'success');
        onBooked(order.id);
      },
      onError: (e) => {
        haptic.error();
        if (isApiError(e) && e.code === 'CONFLICT' && e.details?.price !== undefined) catalog.refetch();
        // A balance or a method may have changed since the list was loaded.
        if (isApiError(e) && e.status >= 400 && e.status < 500) qc.invalidateQueries({ queryKey: qk.carWashPaymentOptions(accountId, cityId) });
        toast(errorMessage(e), 'danger');
      },
    },
  );
  const confirm = () => {
    const input = draftOrder();
    if (input) book.run(input);
  };

  const applyMyPosition = async () => {
    if (!locate) return;
    setLocating(true);
    try {
      const p = await locate();
      if (!p) {
        toast('Position indisponible. Choisissez l’endroit sur la carte.', 'danger');
        return;
      }
      const found = await api.places.reverse(p).catch(() => ({ id: null, label: 'Ma position', address: 'Position actuelle', location: p }));
      setPlace({ ...found, label: 'Position actuelle' });
      haptic.success();
    } finally {
      setLocating(false);
    }
  };

  if (pinOpen) return <PinPicker initial={place?.location ?? center} zones={zones} onCancel={() => setPinOpen(false)} onConfirm={(p) => (setPlace(p), setPinOpen(false))} />;

  if (catalog.data && !catalog.data.available) {
    return (
      <Screen header={<Header title="Lavage à domicile" onBack={onBack} />}>
        <EmptyState title={`Bientôt à ${catalog.data.cityName}`} message="Le lavage à domicile n’est pas encore proposé dans cette ville." action={{ label: 'Retour', onPress: onBack }} />
      </Screen>
    );
  }

  const canContinue = [!!place && inZone, !!carComplete, !!pkg, timing === 'now' || !!time, !!option][step];
  const reason = [!place ? 'Indiquez où est garée la voiture.' : !inZone ? 'Cet endroit est hors de la zone desservie.' : undefined, 'Complétez la voiture et sa plaque.', undefined, 'Choisissez un créneau.', 'Choisissez un moyen de paiement.'][step];
  const back = () => (step === 0 ? onBack() : setStep(step - 1));
  const when = timing === 'now' ? `Dès que possible · arrivée estimée sous ${cat?.nowEtaMinutes ?? 40} min` : time ? formatDateTime(casablancaLocalToUtc(day, time)) : 'Créneau à choisir';
  const pickTiming = (v: WashTiming) => (v === 'now' && nowClosed ? toast(`« Maintenant » n’est pas disponible. ${nowClosed}`) : setTiming(v));

  return (
    <Screen
      keyboard
      testID="car-wash-booking"
      header={<Header title={STEPS[step]} onBack={back} progress={{ step: step + 1, total: STEPS.length }} />}
      footer={
        step < STEPS.length - 1 ? (
          <Button label="Continuer" size="major" full disabled={!canContinue} disabledReason={canContinue ? undefined : reason} onPress={() => setStep(step + 1)} testID="car-wash-continue" />
        ) : (
          <Button label={pkg ? `Confirmer · ${formatMoney(pkg.price)}` : 'Confirmer'} size="major" full loading={book.isPending} loadingLabel="Réservation…" disabled={!canContinue || !pkg || !place} disabledReason={canContinue ? undefined : reason} onPress={confirm} testID="car-wash-confirm" />
        )
      }
    >
      {catalog.isError ? <ErrorState onRetry={() => catalog.refetch()} /> : null}
      {step === 0 ? (
        <View style={{ gap: 14 }}>
          <Text variant="label" tone="muted">
            Chez vous, au travail ou ailleurs : l’équipe de lavage vient à la voiture.
          </Text>
          {savedPlaces.length ? (
            <ListGroup label="Adresses enregistrées">
              {savedPlaces.map((sp) => (
                <ListRow
                  key={sp.id}
                  testID={`car-wash-saved-${sp.kind}`}
                  title={sp.label}
                  subtitle={sp.place.address}
                  leading={<Icon icon={savedPlaceIcon(sp.kind)} size={24} color={colors.accent} />}
                  selected={place?.id === sp.place.id && place?.label === sp.label}
                  onPress={() => setPlace({ ...sp.place, label: sp.label })}
                />
              ))}
            </ListGroup>
          ) : null}
          {/* P-54: two rows, not two tiles; neither inserts a map that pushes the list down. */}
          <ListGroup label={savedPlaces.length ? 'Autre endroit' : undefined}>
            {locate ? (
              <ListRow
                testID="car-wash-locate"
                title="Ma position"
                subtitle={locating ? 'Recherche de votre position…' : undefined}
                leading={<Icon icon={LocateFixed} size={24} color={colors.accent} />}
                chevron={false}
                onPress={locating ? undefined : applyMyPosition}
              />
            ) : null}
            <ListRow testID="car-wash-pin" title="Choisir sur la carte" leading={<Icon icon={MapPin} size={24} color={colors.accent} />} onPress={() => setPinOpen(true)} />
          </ListGroup>
          {place ? (
            <Card style={{ gap: 10 }} testID="car-wash-place">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`La voiture est ici : ${place.label}, ${place.address}`}>
                  <Text variant="label" weight="semibold">{place.label}</Text>
                  <Text variant="caption" tone="muted" numberOfLines={2}>{place.address}</Text>
                </View>
                <TextButton label="Voir la carte" onPress={() => setMapOpen(true)} testID="car-wash-place-map" />
              </View>
              {!inZone ? <StatusBanner compact tone="danger" title="Hors zone" message="choisissez un endroit dans la zone desservie" /> : null}
            </Card>
          ) : null}
          <FormField label="Précisions pour l’équipe (étage, place, code…)" value={notes} onChangeText={setNotes} maxLength={200} multiline helper="Exemple : sous-sol −1, place 42, badge à l’accueil." testID="car-wash-notes" />
          <Sheet visible={mapOpen && !!place} onClose={() => setMapOpen(false)} title={place?.label} subtitle={place?.address} scroll={false} testID="car-wash-place-sheet">
            {place ? (
              <View style={styles.sheetMap} pointerEvents="none">
                <NayaMap center={place.location} zoom={16} markers={[{ id: 'car', kind: 'destination', coordinate: place.location, label: place.label }]} interactive={false} />
              </View>
            ) : null}
          </Sheet>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: 12 }}>
          {role === 'driver' && vehicle ? <StatusBanner compact tone="info" title="Votre véhicule Naya" message="prérempli depuis votre dossier" /> : null}
          {/* P-53: the driver sign-up's shortcut chips, so most cars take two taps. */}
          <FieldRow>
            <FormField label="Marque" value={car.make} onChangeText={(v) => setCar({ ...car, make: v })} maxLength={40} testID="car-wash-make" />
            <FormField label="Modèle" value={car.model} onChangeText={(v) => setCar({ ...car, model: v })} maxLength={40} testID="car-wash-model" />
          </FieldRow>
          <View style={styles.chips} accessibilityLabel="Marques courantes">
            {MAKES.map((m) => (
              <Pill key={m} label={m} selected={car.make.trim() === m} onPress={() => setCar({ ...car, make: m })} testID={`car-wash-make-${m}`} />
            ))}
          </View>
          <FormField label="Couleur" value={car.color} onChangeText={(v) => setCar({ ...car, color: v })} maxLength={30} testID="car-wash-color" />
          <View style={styles.chips} accessibilityLabel="Couleurs courantes">
            {COLOURS.map((c) => (
              <Pill key={c} label={c} selected={car.color.trim() === c} onPress={() => setCar({ ...car, color: c })} testID={`car-wash-color-${c}`} />
            ))}
          </View>
          <FormField label="Immatriculation" value={car.plate} onChangeText={(v) => setCar({ ...car, plate: v.toUpperCase() })} autoCapitalize="characters" autoCorrect={false} maxLength={20} example="Ex. : 12345-A-6" helper="Pour que l’équipe reconnaisse la voiture." inputStyle={{ letterSpacing: 1 }} testID="car-wash-plate" />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 12 }} accessibilityRole="radiogroup" accessibilityLabel="Formule">
          {!cat ? <Skeleton height={120} /> : null}
          {cat?.packages.map((p) => {
            const on = p.id === pkg?.id;
            return (
              // P-55 (rule 20): selected = 2-pt accent outline plus a filled check, never a tint alone.
              <PressableScale key={p.id} onPress={() => (setPackageId(p.id), haptic.select())} accessibilityRole="radio" accessibilityState={{ checked: on, selected: on }} aria-selected={on} accessibilityLabel={`${p.name}, ${formatMoney(p.price)}, ${p.durationMinutes} minutes. ${p.includes.join(', ')}`} style={[styles.pkg, on ? styles.pkgOn : null]} testID={`car-wash-package-${p.id}`} pressedScale={0.985}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={[styles.radio, on ? styles.radioOn : null]} testID={on ? `car-wash-package-${p.id}-check` : undefined}>
                    {on ? <Check size={14} strokeWidth={3} color={colors.inverse} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="heading">{p.name}</Text>
                    <Text variant="caption" tone="muted">{p.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Money amount={p.price} variant="title" />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon icon={Clock} size={16} color={colors.muted} />
                      <Text variant="caption" tone="muted" numeric>{p.durationMinutes} min</Text>
                    </View>
                  </View>
                </View>
                <View style={{ gap: 4 }}>
                  {p.includes.map((i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Icon icon={Check} size={16} tone="success" />
                      <Text variant="caption" style={{ flex: 1 }}>{i}</Text>
                    </View>
                  ))}
                </View>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: 14 }}>
          <SegmentedControl options={[{ value: 'now', label: 'Maintenant' }, { value: 'scheduled', label: 'Planifier' }]} value={timing} onChange={pickTiming} testID="car-wash-timing" />
          {nowClosed ? <StatusBanner tone="neutral" title="« Maintenant » n’est pas disponible" message={`${nowClosed}${firstSlot ? ` Premier créneau libre : ${firstSlot}.` : ''}`} testID="car-wash-now-closed" /> : null}
          {timing === 'now' ? (
            <StatusBanner tone="neutral" title={`Arrivée estimée sous ${cat?.nowEtaMinutes ?? 40} min`} message={`Les équipes passent de ${cat?.scheduling.openingTime.replace(':', 'h') ?? '08h00'} à ${cat?.scheduling.closingTime.replace(':', 'h') ?? '20h00'}. ${pkg ? `Lavage de ${pkg.durationMinutes} min environ.` : ''}`} />
          ) : (
            <View style={{ gap: 4 }} testID="car-wash-slots">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} accessibilityLabel="Jour" contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {days.map((d) => (
                  <Pill key={d.date} label={d.label} selected={d.date === day} onPress={() => setDay(d.date)} testID={`car-wash-day-${d.date}`} />
                ))}
              </ScrollView>
              {slots.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 }} accessibilityLabel="Heure de début (heure de Rabat)">
                  {slots.map((t) => (
                    <Pill key={t} label={t.replace(':', 'h')} selected={t === time} onPress={() => setTime(t)} testID={`car-wash-time-${t}`} />
                  ))}
                </View>
              ) : (
                <Text variant="caption" tone="muted">Plus de créneau ce jour-là. Choisissez un autre jour.</Text>
              )}
            </View>
          )}
        </View>
      ) : null}

      {step === 4 ? (
        <View style={{ gap: 16 }}>
          {/* The header already says « Paiement »: the group has no label (principle 9). Choices carry a trailing check (X-08). */}
          {payOptions.isLoading ? <SkeletonList rows={3} /> : null}
          {payOptions.isError ? <ErrorState onRetry={() => payOptions.refetch()} /> : null}
          {payOptions.data ? (
            <ListGroup>
              {payOptions.data.map((o) => {
                const ok = usable(o);
                // A wallet short of the price is shown with its balance (« Disponible : … ») but not offered.
                const short = !ok && walletBalance(o) !== null;
                return (
                  <ListRow
                    key={o.id}
                    testID={`car-wash-pay-${o.kind}`}
                    title={o.label}
                    subtitle={ok ? (o.note ?? undefined) : `${short ? `Solde insuffisant${pkg ? ` pour ${formatMoney(pkg.price)}` : ''}` : 'Indisponible'}${o.note ? ` · ${o.note}` : ''}`}
                    leading={<Icon icon={washPaymentIcon(o.kind)} size={24} color={ok ? colors.ink : colors.muted} />}
                    selected={o.id === option?.id}
                    onPress={ok ? () => setPaymentId(o.id) : undefined}
                  />
                );
              })}
            </ListGroup>
          ) : null}
          <Card style={{ gap: 10 }} testID="car-wash-summary">
            <SummaryLine label="Où" value={place?.label ?? '—'} sub={notes.trim() || place?.address} />
            <SummaryLine label="Voiture" value={`${car.make} ${car.model} · ${car.color}`} sub={car.plate.toUpperCase()} />
            <SummaryLine label="Formule" value={pkg ? `${pkg.name} · ${pkg.durationMinutes} min` : '—'} />
            <SummaryLine label="Quand" value={when} />
            <View style={styles.rule} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="label" weight="semibold" style={{ flex: 1 }}>Total</Text>
              {pkg ? <Money amount={pkg.price} variant="title" /> : null}
            </View>
          </Card>
          {cat ? (
            // P-51: one policy line; the full conditions open in a sheet.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                Annulation gratuite tant qu’aucune équipe n’est assignée.
              </Text>
              <TextButton label="Conditions" onPress={() => setPolicyOpen(true)} testID="car-wash-policy" />
            </View>
          ) : null}
          {cat ? (
            <Sheet visible={policyOpen} onClose={() => setPolicyOpen(false)} title="Conditions d’annulation" testID="car-wash-policy-sheet">
              <View style={{ gap: 12 }}>
                {[
                  'Gratuite tant qu’aucune équipe n’est assignée.',
                  `Ensuite, gratuite jusqu’à ${Math.round(cat.cancellation.freeUntilMinutesBefore / 60)} h avant le créneau, ou dans les ${Math.round(cat.cancellation.graceSeconds / 60)} min qui suivent l’attribution.`,
                  `Après ce délai : ${formatMoney(cat.cancellation.lateFee)} de frais, ${formatMoney(cat.cancellation.enRouteFee)} si l’équipe est en route.`,
                  'Plus d’annulation une fois le lavage commencé.',
                ].map((line) => (
                  <Text key={line} variant="body">
                    {line}
                  </Text>
                ))}
              </View>
            </Sheet>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function SummaryLine({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }} accessible accessibilityLabel={`${label} : ${value}${sub ? `, ${sub}` : ''}`}>
      <Text variant="caption" tone="muted" style={{ width: 64 }}>{label}</Text>
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text variant="label" weight="semibold" style={{ flexShrink: 1 }}>{value}</Text>
        </View>
        {sub ? <Text variant="caption" tone="muted" numberOfLines={2}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/** Manual pin: the map moves under a fixed centre pin; the address resolves when it stops. */
function PinPicker({ initial, zones, onConfirm, onCancel }: { initial: LatLng; zones: ServiceZone[]; onConfirm: (p: Place) => void; onCancel: () => void }) {
  useTheme();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [center, setCenter] = useState(initial);
  const place = useQuery({ queryKey: ['naya', 'public', 'reverse', center.lat.toFixed(5), center.lng.toFixed(5)], queryFn: () => api.places.reverse(center) });
  const inZone = !zones.length || isInService(center, zones);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="car-wash-pin-picker">
      <NayaMap center={initial} zoom={17} onCenterChange={setCenter} bottomInset={240} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 240, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          {/* inverse only on accent (dark-mode token rules). */}
          <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}>
            <Text variant="caption" tone="inverse" weight="semibold">La voiture est ici</Text>
          </View>
          <MapPin size={40} color={colors.accent} fill={colors.surface} strokeWidth={2} />
        </View>
      </View>
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter }}>
        <IconButton icon={<Icon icon={X} size={24} />} accessibilityLabel="Annuler" onPress={onCancel} testID="car-wash-pin-cancel" />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: gutter, paddingBottom: insets.bottom + 16, gap: 12, ...shadow.float }}>
        <Text variant="heading">Où est garée la voiture ?</Text>
        <Text variant="label" tone="muted" numberOfLines={2}>{place.data?.address ?? 'Déplacez la carte pour placer le repère…'}</Text>
        {!inZone ? <StatusBanner compact tone="danger" title="Hors zone" message="déplacez le repère dans la zone de service" /> : null}
        <Button label="Confirmer cet endroit" size="major" full disabled={!place.data || !inZone} onPress={() => place.data && onConfirm(place.data)} testID="car-wash-pin-confirm" />
      </View>
    </View>
  );
}

/* ───────────── Tracking, receipt, rating, cancellation ───────────── */

export function CarWashOrderScreen({ accountId, orderId, onBack, onHelp }: { accountId: string; orderId: string; onBack: () => void; onHelp?: () => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: qk.carWashOrder(accountId, orderId),
    queryFn: () => api.carWash.get(orderId),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 4000;
      if (isWashOpen(d.order.status)) return 2000;
      // Only a card payment settles on its own (the provider answers). A pending cash fee waits for
      // the assistance team, so polling for it would never end (CW-M1).
      return d.payments.some((p) => p.status === 'pending' && p.method === 'card') ? 4000 : false;
    },
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const o = detail.data?.order;

  if (detail.isError && !o) {
    return (
      <Screen header={<Header title="Lavage" onBack={onBack} />}>
        <ErrorState onRetry={() => detail.refetch()} />
      </Screen>
    );
  }
  if (!o) {
    return (
      <Screen header={<Header title="Lavage" onBack={onBack} />}>
        <View style={{ gap: 12 }}>
          <Skeleton height={180} />
          <Skeleton height={120} />
        </View>
      </Screen>
    );
  }
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.carWashOrder(accountId, orderId) });
    qc.invalidateQueries({ queryKey: qk.carWashOrders(accountId) });
  };
  const mainPayment = detail.data!.payments.find((p) => p.purpose === 'car_wash');
  const feePayment = detail.data!.payments.find((p) => p.purpose === 'car_wash_fee');
  const live = o.status === 'en_route' || o.status === 'washing';
  const status = statusPresentation('wash', o.status);

  return (
    // The order's state is said once, as the title (first sight, C15); the timeline marks where it stands.
    <Screen header={<Header title={status.label} subtitle={`${o.terms.packageName} · ${o.id}`} onBack={onBack} />} testID="car-wash-order">
      <View style={{ gap: 16 }}>
        {o.status === 'cancelled' && o.cancellation ? (
          // R3: a cancellation is neutral, not a failure. The title already says « Lavage annulé ».
          <StatusBanner kind="wash" state="cancelled" title={o.cancellation.fee > 0 ? `Frais d’annulation : ${formatMoney(o.cancellation.fee)}` : 'Annulé sans frais'} message={o.cancellation.reasonText} testID="car-wash-cancelled" />
        ) : null}

        {live && o.teamLocation ? (
          <Card padded={false} style={{ overflow: 'hidden' }} testID="car-wash-live-map">
            <View style={{ height: 210 }}>
              <NayaMap
                center={o.location.location}
                zoom={15}
                markers={[
                  { id: 'car', kind: 'destination', coordinate: o.location.location, label: 'Votre voiture' },
                  ...(o.status === 'en_route' ? [{ id: 'team', kind: 'driver' as const, coordinate: o.teamLocation.location, label: o.team?.name ?? 'Équipe de lavage' }] : []),
                ]}
                fitTo={o.status === 'en_route' ? [o.location.location, o.teamLocation.location] : undefined}
                interactive={false}
              />
            </View>
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon icon={Clock} size={20} color={colors.accent} />
              <Text variant="label" weight="semibold" style={{ flex: 1 }} testID="car-wash-eta">
                {o.status === 'en_route' ? `Arrivée dans ~${o.teamLocation.etaMinutes ?? 1} min` : `Fin prévue vers ${formatTime(new Date(Date.parse(o.startedAt ?? o.startAt) + o.terms.durationMinutes * 60_000).toISOString())}`}
              </Text>
            </View>
          </Card>
        ) : null}

        <Card style={{ gap: 0 }} testID="car-wash-timeline">
          {WASH_PROGRESS.map((s, i) => (
            <TimelineStep key={s} status={s} order={o} last={i === WASH_PROGRESS.length - 1} />
          ))}
        </Card>

        {o.team ? (
          // A18: the team's avatar, not a decorative droplet. No call line: masked calls are not live (R8).
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="car-wash-team">
            <View accessible accessibilityLabel={`${o.team.name}, ${o.team.vehicleLabel}, note ${o.team.ratingAverage.toFixed(1).replace('.', ',')} sur 5`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Avatar name={o.team.name} size={40} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" weight="semibold">{o.team.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text variant="caption" tone="muted" style={{ flexShrink: 1 }} numberOfLines={1}>{o.team.vehicleLabel}</Text>
                  <Text variant="caption" tone="muted">·</Text>
                  <Icon icon={Star} size={16} color={colors.accent} />
                  <Text variant="caption" tone="muted" numeric>{o.team.ratingAverage.toFixed(1).replace('.', ',')}</Text>
                </View>
              </View>
            </View>
          </Card>
        ) : null}

        {o.photos.length ? <WashPhotos order={o} accountId={accountId} /> : null}

        <Section title={o.status === 'completed' ? 'Reçu' : 'Votre commande'} style={{ marginTop: 4 }}>
          <Card style={{ gap: 10 }} testID="car-wash-receipt">
            <SummaryLine label="Où" value={o.location.label} sub={o.parkingNotes || o.location.address} />
            <SummaryLine label="Voiture" value={`${o.car.make} ${o.car.model} · ${o.car.color}`} sub={o.car.plate} />
            <SummaryLine label="Formule" value={`${o.terms.packageName} · ${o.terms.durationMinutes} min`} sub={o.terms.includes.join(' · ')} />
            <SummaryLine label="Quand" value={o.timing === 'now' ? `Dès que possible · ${formatShort(o.createdAt)}` : formatDateTime(o.startAt)} />
            <SummaryLine
              label="Paiement"
              value={o.paymentMethod.label}
              sub={mainPayment ? PAYMENT_STATUS_LABELS[mainPayment.status] : o.status === 'cancelled' ? undefined : 'Réglé à la fin du lavage'}
              // C3/C19: the method's glyph, with the payment state as its badge once a payment exists.
              icon={
                mainPayment ? (
                  <StatusIcon kind="payment" state={mainPayment.status} accessible={false} badgeOn={<Icon icon={washPaymentIcon(o.paymentMethod.kind)} size={20} />} testID="car-wash-payment-status" />
                ) : (
                  <Icon icon={washPaymentIcon(o.paymentMethod.kind)} size={20} />
                )
              }
            />
            {feePayment ? <SummaryLine label="Frais" value={formatMoney(feePayment.amount)} sub={PAYMENT_STATUS_LABELS[feePayment.status]} /> : null}
            <View style={styles.rule} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="label" weight="semibold" style={{ flex: 1 }}>{o.status === 'cancelled' ? 'Prix réservé' : 'Total'}</Text>
              <Money amount={o.terms.price} variant="title" />
            </View>
          </Card>
          {mainPayment?.status === 'failed' ? <StatusBanner tone="danger" title="Paiement refusé" message="Contactez l’assistance pour régler ce lavage." action={onHelp ? { label: 'Assistance', onPress: onHelp } : undefined} style={{ marginTop: 10 }} /> : null}
        </Section>

        {o.status === 'completed' ? <RatingBlock order={o} onDone={refresh} /> : null}

        {/* P-52: no full-width outline as the only action. Help first, the destructive action last, in red text. */}
        <View style={{ gap: 4, marginTop: 4 }}>
          {onHelp ? <TextButton label="Un problème ? Contacter l’assistance" onPress={onHelp} testID="car-wash-help" /> : null}
          {o.status === 'booked' || o.status === 'washer_assigned' || o.status === 'en_route' ? <TextButton label="Annuler le lavage" tone="danger" onPress={() => setCancelOpen(true)} testID="car-wash-cancel" /> : null}
          {o.status === 'washing' ? (
            <Text variant="caption" tone="muted" align="center">
              Le lavage a commencé : il ne peut plus être annulé.
            </Text>
          ) : null}
        </View>
      </View>
      <CancelWashSheet accountId={accountId} order={o} visible={cancelOpen} onClose={() => setCancelOpen(false)} onCancelled={() => (setCancelOpen(false), refresh())} />
    </Screen>
  );
}

/**
 * A19, the timeline model the other screens copy: filled check = done, ring = current, hollow = to do.
 * Shape carries the step's state, not colour alone, and the state is read with the step.
 */
function TimelineStep({ status, order, last }: { status: (typeof WASH_PROGRESS)[number]; order: WashOrder; last: boolean }) {
  useTheme();
  const reached = order.status === 'cancelled' ? stepAt(order, status) !== null : WASH_PROGRESS.indexOf(status) <= WASH_PROGRESS.indexOf(order.status as (typeof WASH_PROGRESS)[number]);
  const current = order.status === status && status !== 'completed';
  const at = stepAt(order, status);
  const word = current ? 'en cours' : reached ? 'fait' : 'à venir';
  return (
    <View style={{ flexDirection: 'row', gap: 12 }} accessible accessibilityLabel={`${WASH_STATUS_LABELS[status]}, ${word}${reached && at ? `, ${formatTime(at)}` : ''}`} testID={`car-wash-step-${status}`}>
      <View style={{ alignItems: 'center', width: 22 }}>
        <View style={[styles.dot, reached ? { backgroundColor: colors.accent, borderColor: colors.accent } : null, current ? styles.dotCurrent : null]}>{reached && !current ? <Check size={12} color={colors.inverse} strokeWidth={3} /> : null}</View>
        {last ? null : <View style={[styles.stem, reached && !current ? { backgroundColor: colors.accent } : null]} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 14, flexDirection: 'row', gap: 8 }}>
        <Text variant="label" weight={current ? 'semibold' : 'medium'} tone={reached ? 'ink' : 'muted'} style={{ flex: 1 }}>
          {WASH_STATUS_LABELS[status]}
        </Text>
        {at ? <Text variant="caption" tone="muted" numeric>{formatTime(at)}</Text> : null}
      </View>
    </View>
  );
}

function stepAt(o: WashOrder, s: (typeof WASH_PROGRESS)[number]): string | null {
  return { booked: o.createdAt, washer_assigned: o.assignedAt, en_route: o.departedAt, washing: o.startedAt, completed: o.completedAt }[s];
}

/** Labels written before 14 Oct 2026 end with a « (photo …) » marker: shown without it. */
const photoCaption = (label: string) => label.replace(/ \(photo [^)]*\)$/, '');

const STAGE_WORD = { before: 'Avant', after: 'Après' } as const;

interface PhotoAngle {
  key: string;
  /** « Carrosserie », « Jantes »… from the shot's label (« Avant · carrosserie »). */
  title: string;
  before: WashPhoto | null;
  after: WashPhoto | null;
}

/**
 * Pairs the team's shots by angle (R13): one row per angle with its « Avant » and « Après ». The angle
 * is what follows « · » in the label; a label without one is paired by its rank within its stage.
 */
function photoAngles(photos: WashPhoto[]): PhotoAngle[] {
  const out: PhotoAngle[] = [];
  const rank = { before: 0, after: 0 };
  for (const p of photos) {
    const n = rank[p.stage]++;
    const parts = photoCaption(p.label).split(' · ');
    const what = parts.length > 1 ? parts.slice(1).join(' · ').trim() : '';
    const key = what ? what.toLowerCase() : `#${n}`;
    let angle = out.find((a) => a.key === key && !a[p.stage]);
    if (!angle) {
      angle = { key, title: what ? what.charAt(0).toUpperCase() + what.slice(1) : `Photo ${n + 1}`, before: null, after: null };
      out.push(angle);
    }
    angle[p.stage] = p;
  }
  return out;
}

/**
 * P-50 / R13: a row per angle with Avant and Après as 4:3 thumbnails side by side (about 167 × 125 on
 * a 390-pt phone). A tap opens both shots in large. A missing shot is a neutral placeholder with a
 * glyph, never a blank tile.
 */
function WashPhotos({ order, accountId }: { order: WashOrder; accountId: string }) {
  useTheme();
  const angles = useMemo(() => photoAngles(order.photos), [order.photos]);
  const [viewing, setViewing] = useState<PhotoAngle | null>(null);
  const [open, setOpen] = useState(false);
  // While the order is open, a missing « Après » is still to come.
  const pending = isWashOpen(order.status);
  const show = (a: PhotoAngle) => {
    setViewing(a);
    setOpen(true);
  };
  return (
    <Section title="Photos" style={{ marginTop: 4 }}>
      <View style={{ gap: 16 }} testID="car-wash-photos">
        {angles.map((a, i) => (
          <View key={`${a.key}-${i}`} style={{ gap: 8 }} testID={`car-wash-angle-${i}`}>
            <Text variant="label" weight="semibold">{a.title}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(['before', 'after'] as const).map((stage) => (
                <PhotoTile key={stage} stage={stage} angle={a} accountId={accountId} pending={pending} onOpen={() => show(a)} />
              ))}
            </View>
          </View>
        ))}
        <Text variant="caption" tone="muted">Photos prises par l’équipe avant et après le lavage.</Text>
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={viewing?.title} testID="car-wash-photo-viewer">
        <View style={{ gap: 16 }}>
          {viewing
            ? (['before', 'after'] as const).map((stage) => {
                const p = viewing[stage];
                return p ? (
                  <View key={stage} style={{ gap: 8 }}>
                    <Text variant="label" weight="semibold">{STAGE_WORD[stage]}</Text>
                    <View accessible accessibilityRole="image" accessibilityLabel={photoCaption(p.label)}>
                      <WashPhotoImage photo={p} accountId={accountId} />
                    </View>
                  </View>
                ) : null;
              })
            : null}
        </View>
      </Sheet>
    </Section>
  );
}

function PhotoTile({ stage, angle, accountId, pending, onOpen }: { stage: WashPhoto['stage']; angle: PhotoAngle; accountId: string; pending: boolean; onOpen: () => void }) {
  useTheme();
  const photo = angle[stage];
  const word = STAGE_WORD[stage];
  if (!photo) {
    const missing = pending ? 'À venir' : 'Pas de photo';
    return (
      <View style={{ flex: 1, gap: 6 }} accessible accessibilityLabel={`${word} · ${angle.title.toLowerCase()}, ${missing.toLowerCase()}`} testID={`car-wash-photo-missing-${stage}`}>
        <View style={[styles.frame, styles.placeholder]}>
          <Icon icon={ImageOff} size={24} color={colors.muted} />
          <Text variant="caption" tone="muted">{missing}</Text>
        </View>
        <Text variant="caption" weight="semibold">{word}</Text>
      </View>
    );
  }
  return (
    <PressableScale style={{ flex: 1, gap: 6 }} onPress={onOpen} accessibilityRole="imagebutton" accessibilityLabel={photoCaption(photo.label)} accessibilityHint="Affiche les photos en grand" pressedScale={0.98} testID={`car-wash-photo-${photo.id}`}>
      <WashPhotoImage photo={photo} accountId={accountId} />
      <Text variant="caption" weight="semibold">{word}</Text>
    </PressableScale>
  );
}

/**
 * A 4:3 frame with the shot filling it. The image is absolutely placed inside a frame that owns the
 * aspect ratio, so the photo's own size can never stretch the tile (the tall, half-blank tiles of P-50).
 */
function WashPhotoImage({ photo, accountId }: { photo: WashPhoto; accountId: string }) {
  useTheme();
  const api = useApi();
  // Same key as the shared Attachment preview, so both read one cached copy.
  const upload = useQuery({ queryKey: ['naya', accountId, 'attachment', photo.uploadId ?? 'none'], queryFn: () => api.uploadPreview(photo.uploadId!), enabled: !!photo.uploadId });
  const source = photo.uploadId
    ? upload.data && upload.data.mimeType.startsWith('image/')
      ? { uri: upload.data.uri }
      : null
    : photo.stage === 'before'
      ? mockPhotos.carWashBefore
      : mockPhotos.carWashAfter;
  const failed = !!photo.uploadId && (upload.isError || (!!upload.data && !source));
  return (
    <View style={[styles.frame, source ? null : styles.placeholder]}>
      {source ? (
        <Image source={source} style={styles.photo} resizeMode="cover" />
      ) : failed ? (
        <>
          <Icon icon={ImageOff} size={24} color={colors.muted} />
          <Text variant="caption" tone="muted">Photo indisponible</Text>
        </>
      ) : null}
    </View>
  );
}

function RatingBlock({ order, onDone }: { order: WashOrder; onDone: () => void }) {
  useTheme();
  const api = useApi();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  // Single flight: a double tap sends one rating. The rating route takes no Idempotency-Key; the
  // server refuses a second rating (409).
  const rate = useSingleFlight((input: { stars: number; comment: string | null }) => api.carWash.rate(order.id, input.stars, input.comment), {
    onSuccess: () => {
      haptic.success();
      onDone();
    },
    onError: (e) => {
      haptic.error();
      toast(errorMessage(e), 'danger');
    },
  });
  if (order.rating) {
    return (
      <Card style={{ gap: 6 }} testID="car-wash-rated">
        <Text variant="label" weight="semibold">Merci pour votre note</Text>
        <Stars value={order.rating.stars} />
        {order.rating.comment ? <Text variant="caption" tone="muted">{order.rating.comment}</Text> : null}
      </Card>
    );
  }
  return (
    <Card style={{ gap: 12 }} testID="car-wash-rating">
      <Text variant="label" weight="semibold">Comment s’est passé le lavage ?</Text>
      <Stars value={stars} onChange={setStars} />
      <FormField label="Un commentaire (facultatif)" value={comment} onChangeText={setComment} maxLength={500} multiline />
      {/* Sent: stays disabled until the refreshed order shows the rating, so a second tap cannot hit the 409. */}
      <Button label="Envoyer la note" disabled={!stars || rate.isSuccess} disabledReason={stars ? undefined : 'Choisissez une note.'} loading={rate.isPending} onPress={() => rate.run({ stars, comment: comment.trim() || null })} testID="car-wash-rate" />
    </Card>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole={onChange ? 'adjustable' : undefined} accessibilityLabel={`Note : ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star size={30} color={n <= value ? colors.accent : colors.outline} fill={n <= value ? colors.accent : 'transparent'} />;
        return onChange ? (
          <PressableScale key={n} onPress={() => (onChange(n), haptic.select())} accessibilityRole="button" accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`} hitSlop={6} testID={`car-wash-star-${n}`}>
            {icon}
          </PressableScale>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}

function CancelWashSheet({ accountId, order, visible, onClose, onCancelled }: { accountId: string; order: WashOrder; visible: boolean; onClose: () => void; onCancelled: () => void }) {
  useTheme();
  const api = useApi();
  const preview = useQuery({ queryKey: qk.carWashCancelPreview(accountId, order.id), queryFn: () => api.carWash.cancellationPreview(order.id), enabled: visible, refetchInterval: visible ? 5000 : false });
  const [reason, setReason] = useState<string>('changed_plans');
  const [other, setOther] = useState('');
  // The request is the mutation's variables: a retry after a network error replays the same key,
  // a changed reason or fee gets a new one (ADR-0053, CW-12).
  const cancel = useSingleFlight((input: CancelInput, key: string) => api.carWash.cancel(order.id, input, key), {
    onSuccess: () => {
      haptic.success();
      toast('Lavage annulé', 'success');
      onCancelled();
    },
    onError: (e) => {
      haptic.error();
      preview.refetch();
      toast(errorMessage(e), 'danger');
    },
  });
  const fee = preview.data?.fee ?? 0;
  return (
    <Sheet visible={visible} onClose={onClose} title="Annuler le lavage ?" subtitle={preview.data?.explanation} testID="car-wash-cancel-sheet">
      <View style={{ gap: 12 }}>
        {preview.isLoading ? <Skeleton height={48} /> : null}
        {preview.data ? <StatusBanner tone={fee > 0 ? 'warning' : 'success'} title={fee > 0 ? `Frais d’annulation : ${formatMoney(fee)}` : 'Annulation gratuite'} message={preview.data.freeUntil ? `jusqu’à ${formatTime(preview.data.freeUntil)}` : order.paymentMethod.kind === 'driver_wallet' ? `${formatMoney(order.terms.price - fee)} remboursés sur votre portefeuille` : undefined} /> : null}
        {/* §5.6: a choice sheet uses rows with a trailing check. */}
        <ListGroup label="Motif">
          {WASH_CANCEL_REASONS.map((r) => (
            <ListRow key={r.code} title={r.label} selected={reason === r.code} onPress={() => setReason(r.code)} testID={`car-wash-reason-${r.code}`} />
          ))}
        </ListGroup>
        {reason === 'other' ? <FormField label="Motif" value={other} onChangeText={setOther} maxLength={200} /> : null}
        <Button label={fee > 0 ? `Annuler · ${formatMoney(fee)} de frais` : 'Annuler sans frais'} variant="danger" full loading={cancel.isPending} disabled={!preview.data || preview.data.reason === 'not_cancellable'} onPress={() => cancel.run({ reasonCode: reason, reasonText: reason === 'other' ? other.trim() || undefined : undefined, acknowledgedFee: fee })} testID="car-wash-cancel-confirm" />
        <Button label="Garder mon lavage" variant="ghost" full onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    entry: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background },
    // The selected card swaps a 1-pt outline for a 2-pt accent one; the padding absorbs the difference so nothing moves.
    pkg: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.outline },
    pkgOn: { borderWidth: 2, padding: 15, borderColor: colors.accent, backgroundColor: colors.selected },
    radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    radioOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
    dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.outline, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    dotCurrent: { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 6 },
    stem: { width: 2, flex: 1, minHeight: 14, backgroundColor: colors.line },
    sheetMap: { height: 260, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.map },
    frame: { width: '100%', aspectRatio: mockPhotoAspect, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.map },
    placeholder: { backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
    photo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  }),
);
