import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Clock, Droplets, LocateFixed, MapPin, Star, X } from 'lucide-react-native';
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
  toCasablancaParts,
  washSlots,
  WASH_CANCEL_REASONS,
  WASH_PROGRESS,
  WASH_STATUS_LABELS,
  type LatLng,
  type Place,
  type SavedPlace,
  type ServiceZone,
  type Vehicle,
  type WashOrder,
  type WashOrderStatus,
  type WashPackageId,
  type WashCar,
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
import { Button, IconButton } from '../Button';
import { FormField, Pill } from '../Form';
import { EmptyState, ErrorState, Skeleton, StatusBanner, StatusPill, type BannerTone } from '../Feedback';
import { Card, IconDisc, ListGroup, ListRow } from '../List';
import { Sheet } from '../BottomSheet';
import { SegmentedControl } from '../SegmentedControl';
import { PressableScale } from '../PressableScale';
import { Money } from '../Ride';
import { toast } from '../Toast';
import { haptic } from '../haptics';
import { NayaMap } from '../map';
import { Attachment } from './Attachment';

/**
 * « Lavage à domicile », shared by the passenger and driver apps. Route files stay thin:
 * they pass the account, the role and what only the app knows (saved places, vehicle,
 * how to read the phone's position). The washing team is played by the mock backend; its
 * before/after shots come from @naya/assets `mockPhotos` until the team uploads real ones.
 */

const STATUS_TONE: Record<WashOrderStatus, BannerTone> = {
  booked: 'neutral',
  washer_assigned: 'info',
  en_route: 'info',
  washing: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

/* ───────────── Entry card (home) ───────────── */

/** Secondary service card for the home screens. Kept to one compact row so the ride flow stays first. */
export function CarWashEntry({ onPress, testID = 'car-wash-entry' }: { onPress: () => void; testID?: string }) {
  useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Lavage à domicile. Votre voiture lavée là où elle est garée." style={styles.entry} testID={testID} pressedScale={0.985}>
      <IconDisc tone="accent" size={36}>
        <Droplets size={18} color={colors.accent} />
      </IconDisc>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="label" weight="semibold" numberOfLines={1}>
          Lavage à domicile
        </Text>
        <Text variant="micro" tone="muted" numberOfLines={1}>
          Votre voiture lavée là où elle est garée
        </Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
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
        {orders.isLoading ? <Skeleton height={64} /> : null}
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

function OrderRow({ order, onPress }: { order: WashOrder; onPress: () => void }) {
  return (
    <ListRow
      testID={`car-wash-order-${order.id}`}
      title={`${order.terms.packageName} · ${order.car.make} ${order.car.model}`}
      subtitle={`${formatShort(order.startAt)} · ${order.location.label}`}
      trailing={<StatusPill tone={STATUS_TONE[order.status]} label={WASH_STATUS_LABELS[order.status]} />}
      onPress={onPress}
    />
  );
}

/* ───────────── Booking ───────────── */

const STEPS = ['Où est la voiture ?', 'La voiture', 'La formule', 'Quand ?', 'Paiement'] as const;
const weekday = new Intl.DateTimeFormat('fr-MA', { weekday: 'short', day: 'numeric', timeZone: 'Africa/Casablanca' });

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
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState('');
  // Untouched, the car follows the driver's vehicle file (which may load after the screen).
  const [carDraft, setCar] = useState<WashCar | null>(null);
  const car = carDraft ?? { make: vehicle?.make ?? '', model: vehicle?.model ?? '', color: vehicle?.color ?? '', plate: vehicle?.plate ?? '' };
  const [packageId, setPackageId] = useState<WashPackageId>('exterior');
  const [timing, setTiming] = useState<WashTiming>('now');
  const [day, setDay] = useState(() => toCasablancaParts(new Date(serverClock.now()).toISOString()).date);
  const [pickedTime, setTime] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const cat = catalog.data?.available ? catalog.data : null;
  const pkg = cat?.packages.find((p) => p.id === packageId) ?? cat?.packages[0];
  const days = useMemo(() => {
    const now = serverClock.now();
    return Array.from({ length: cat?.scheduling.maxDaysAhead ?? 7 }, (_, i) => {
      const iso = new Date(now + i * 86_400_000).toISOString();
      return { date: toCasablancaParts(iso).date, label: i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : weekday.format(new Date(iso)) };
    });
  }, [cat?.scheduling.maxDaysAhead]);
  const slots = cat && pkg ? washSlots(cat.scheduling, pkg.durationMinutes, day, serverClock.now()) : [];
  // A slot that no longer fits (other day, longer package) falls back to the first one offered.
  const time = pickedTime && slots.includes(pickedTime) ? pickedTime : (slots[0] ?? null);

  const option = payOptions.data?.find((o) => o.id === paymentId && o.available) ?? payOptions.data?.find((o) => o.isDefault && o.available) ?? payOptions.data?.find((o) => o.available);
  const carComplete = car.make.trim() && car.model.trim() && car.color.trim() && car.plate.trim().length >= 2;
  const inZone = place ? isInService(place.location, zones) || !zones.length : false;
  const vehicleId = role === 'driver' && vehicle && car.plate.trim() === vehicle.plate ? vehicle.id : null;

  const book = useSingleFlight(
    async (_v: void, key: string) => {
      if (!place || !pkg || !option) throw new Error('Commande incomplète.');
      return api.carWash.create(
        {
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
        },
        key,
      );
    },
    {
      onSuccess: (order) => {
        haptic.success();
        qc.invalidateQueries({ queryKey: qk.carWashOrders(accountId) });
        qc.invalidateQueries({ queryKey: qk.carWashPaymentOptions(accountId, cityId) });
        if (role === 'driver') qc.invalidateQueries({ queryKey: qk.wallet(accountId) });
        toast('Lavage réservé');
        onBooked(order.id);
      },
      onError: (e) => {
        haptic.error();
        if (isApiError(e) && e.code === 'CONFLICT' && e.details?.price !== undefined) {
          catalog.refetch();
          book.reset();
        }
        toast(errorMessage(e), 'danger');
      },
    },
  );

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

  return (
    <Screen
      keyboard
      testID="car-wash-booking"
      header={<Header title={STEPS[step]} onBack={back} progress={{ step: step + 1, total: STEPS.length }} />}
      footer={
        step < STEPS.length - 1 ? (
          <Button label="Continuer" size="major" full disabled={!canContinue} disabledReason={canContinue ? undefined : reason} onPress={() => setStep(step + 1)} testID="car-wash-continue" />
        ) : (
          <Button label={pkg ? `Confirmer · ${formatMoney(pkg.price)}` : 'Confirmer'} size="major" full loading={book.isPending} loadingLabel="Réservation…" disabled={!canContinue || !pkg || !place} disabledReason={canContinue ? undefined : reason} onPress={() => book.run()} testID="car-wash-confirm" />
        )
      }
    >
      {catalog.isError ? <ErrorState onRetry={() => catalog.refetch()} /> : null}
      {step === 0 ? (
        <View style={{ gap: 14 }}>
          <Text variant="label" tone="muted">
            Chez vous, au travail ou ailleurs : l’équipe de lavage vient à la voiture.
          </Text>
          {place ? (
            <Card padded={false} style={{ overflow: 'hidden' }} testID="car-wash-place">
              <View style={{ height: 150 }} pointerEvents="none">
                <NayaMap center={place.location} zoom={16} markers={[{ id: 'car', kind: 'destination', coordinate: place.location, label: place.label }]} interactive={false} />
              </View>
              <View style={{ padding: 14, gap: 2 }}>
                <Text variant="label" weight="semibold">{place.label}</Text>
                <Text variant="caption" tone="muted" numberOfLines={2}>{place.address}</Text>
                {!inZone ? <StatusBanner compact tone="danger" title="Hors zone" message="choisissez un endroit dans la zone desservie" /> : null}
              </View>
            </Card>
          ) : null}
          {savedPlaces.length ? (
            <ListGroup label="Adresses enregistrées">
              {savedPlaces.map((sp) => (
                <ListRow key={sp.id} testID={`car-wash-saved-${sp.kind}`} title={sp.label} subtitle={sp.place.address} leading={<MapPin size={18} color={colors.accent} />} trailing={place?.id === sp.place.id && place?.label === sp.label ? <Check size={18} color={colors.accent} /> : undefined} onPress={() => (setPlace({ ...sp.place, label: sp.label }), haptic.select())} />
              ))}
            </ListGroup>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {locate ? <Button label="Ma position" variant="secondary" size="compact" style={{ flex: 1 }} full loading={locating} icon={<LocateFixed size={16} color={colors.accent} />} onPress={applyMyPosition} testID="car-wash-locate" /> : null}
            <Button label="Choisir sur la carte" variant="secondary" size="compact" style={{ flex: 1 }} full icon={<MapPin size={16} color={colors.accent} />} onPress={() => setPinOpen(true)} testID="car-wash-pin" />
          </View>
          <FormField label="Précisions pour l’équipe (étage, place, code…)" value={notes} onChangeText={setNotes} maxLength={200} multiline helper="Exemple : sous-sol −1, place 42, badge à l’accueil." testID="car-wash-notes" />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: 12 }}>
          {role === 'driver' && vehicle ? <StatusBanner compact tone="success" title="Votre véhicule Naya" message="préremplie depuis votre dossier" /> : null}
          <FormField label="Marque" value={car.make} onChangeText={(v) => setCar({ ...car, make: v })} maxLength={40} testID="car-wash-make" />
          <FormField label="Modèle" value={car.model} onChangeText={(v) => setCar({ ...car, model: v })} maxLength={40} testID="car-wash-model" />
          <FormField label="Couleur" value={car.color} onChangeText={(v) => setCar({ ...car, color: v })} maxLength={30} testID="car-wash-color" />
          <FormField label="Immatriculation" value={car.plate} onChangeText={(v) => setCar({ ...car, plate: v })} autoCapitalize="characters" maxLength={20} helper="Pour que l’équipe reconnaisse la voiture." testID="car-wash-plate" />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 12 }} accessibilityRole="radiogroup" accessibilityLabel="Formule">
          {!cat ? <Skeleton height={120} /> : null}
          {cat?.packages.map((p) => {
            const on = p.id === pkg?.id;
            return (
              <PressableScale key={p.id} onPress={() => (setPackageId(p.id), haptic.select())} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${p.name}, ${formatMoney(p.price)}, ${p.durationMinutes} minutes`} style={[styles.pkg, on ? styles.pkgOn : null]} testID={`car-wash-package-${p.id}`} pressedScale={0.985}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="heading">{p.name}</Text>
                    <Text variant="caption" tone="muted">{p.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Money amount={p.price} variant="title" />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} color={colors.muted} />
                      <Text variant="micro" tone="muted" numeric>{p.durationMinutes} min</Text>
                    </View>
                  </View>
                </View>
                <View style={{ gap: 3 }}>
                  {p.includes.map((i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Check size={14} color={colors.success} />
                      <Text variant="caption">{i}</Text>
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
          <SegmentedControl options={[{ value: 'now', label: 'Maintenant' }, { value: 'scheduled', label: 'Planifier' }]} value={timing} onChange={setTiming} testID="car-wash-timing" />
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
          <ListGroup label="Paiement">
            {(payOptions.data ?? []).map((o) => (
              <ListRow
                key={o.id}
                testID={`car-wash-pay-${o.kind}`}
                title={o.label}
                subtitle={o.available ? (o.note ?? undefined) : `Indisponible${o.note ? ` · ${o.note}` : ''}`}
                trailing={o.id === option?.id ? <Check size={20} color={colors.accent} /> : undefined}
                onPress={o.available ? () => (setPaymentId(o.id), haptic.select()) : undefined}
              />
            ))}
          </ListGroup>
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
            <Text variant="micro" tone="muted">
              {`Annulation gratuite tant qu’aucune équipe n’est assignée, puis jusqu’à ${Math.round(cat.cancellation.freeUntilMinutesBefore / 60)} h avant le créneau (ou ${Math.round(cat.cancellation.graceSeconds / 60)} min après l’attribution). Ensuite ${formatMoney(cat.cancellation.lateFee)}, et ${formatMoney(cat.cancellation.enRouteFee)} si l’équipe est en route. Plus d’annulation une fois le lavage commencé.`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function SummaryLine({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }} accessible accessibilityLabel={`${label} : ${value}${sub ? `, ${sub}` : ''}`}>
      <Text variant="caption" tone="muted" style={{ width: 64 }}>{label}</Text>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="label" weight="semibold">{value}</Text>
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
          <View style={{ backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}>
            <Text variant="caption" tone="inverse" weight="semibold">La voiture est ici</Text>
          </View>
          <MapPin size={40} color={colors.accent} fill={colors.surface} strokeWidth={2.2} />
        </View>
      </View>
      <View style={{ position: 'absolute', top: insets.top + 8, left: gutter }}>
        <IconButton icon={<X size={22} color={colors.ink} />} accessibilityLabel="Annuler" onPress={onCancel} testID="car-wash-pin-cancel" />
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
      return isWashOpen(d.order.status) ? 2000 : d.payments.some((p) => p.status === 'pending') ? 4000 : false;
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
  const before = o.photos.filter((p) => p.stage === 'before');
  const after = o.photos.filter((p) => p.stage === 'after');

  return (
    <Screen header={<Header title={WASH_STATUS_LABELS[o.status]} subtitle={`${o.terms.packageName} · ${o.id}`} onBack={onBack} />} testID="car-wash-order">
      <View style={{ gap: 16 }}>
        {o.status === 'cancelled' && o.cancellation ? (
          <StatusBanner tone="danger" title={o.cancellation.fee > 0 ? `Lavage annulé · frais ${formatMoney(o.cancellation.fee)}` : 'Lavage annulé sans frais'} message={o.cancellation.reasonText} testID="car-wash-cancelled" />
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
            <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Clock size={18} color={colors.accent} />
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
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="car-wash-team">
            <IconDisc tone="accent" size={44}>
              <Droplets size={20} color={colors.accent} />
            </IconDisc>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="label" weight="semibold">{o.team.name}</Text>
              <Text variant="caption" tone="muted">{`${o.team.vehicleLabel} · ${o.team.ratingAverage.toFixed(1).replace('.', ',')} ★`}</Text>
              <Text variant="micro" tone="muted">{o.team.phoneMasked}</Text>
            </View>
          </Card>
        ) : null}

        {before.length || after.length ? (
          <Section title="Photos" style={{ marginTop: 4 }}>
            <View style={{ gap: 10 }} testID="car-wash-photos">
              {before.length ? <PhotoRow title="Avant" photos={before} accountId={accountId} /> : null}
              {after.length ? <PhotoRow title="Après" photos={after} accountId={accountId} /> : null}
              <Text variant="micro" tone="muted">Photos prises par l’équipe avant et après le lavage.</Text>
            </View>
          </Section>
        ) : null}

        <Section title={o.status === 'completed' ? 'Reçu' : 'Votre commande'} style={{ marginTop: 4 }}>
          <Card style={{ gap: 10 }} testID="car-wash-receipt">
            <SummaryLine label="Où" value={o.location.label} sub={o.parkingNotes || o.location.address} />
            <SummaryLine label="Voiture" value={`${o.car.make} ${o.car.model} · ${o.car.color}`} sub={o.car.plate} />
            <SummaryLine label="Formule" value={`${o.terms.packageName} · ${o.terms.durationMinutes} min`} sub={o.terms.includes.join(' · ')} />
            <SummaryLine label="Quand" value={o.timing === 'now' ? `Dès que possible · ${formatShort(o.createdAt)}` : formatDateTime(o.startAt)} />
            <SummaryLine label="Paiement" value={o.paymentMethod.label} sub={mainPayment ? PAYMENT_STATUS_LABELS[mainPayment.status] : o.status === 'cancelled' ? undefined : 'Réglé à la fin du lavage'} />
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

        {o.status === 'booked' || o.status === 'washer_assigned' || o.status === 'en_route' ? <Button label="Annuler le lavage" variant="secondary" full onPress={() => setCancelOpen(true)} testID="car-wash-cancel" /> : null}
        {o.status === 'washing' ? <Text variant="micro" tone="muted" align="center">Le lavage a commencé : il ne peut plus être annulé.</Text> : null}
        {onHelp ? <Button label="Un problème ? Contacter l’assistance" variant="ghost" full onPress={onHelp} /> : null}
      </View>
      <CancelWashSheet accountId={accountId} order={o} visible={cancelOpen} onClose={() => setCancelOpen(false)} onCancelled={() => (setCancelOpen(false), refresh())} />
    </Screen>
  );
}

function TimelineStep({ status, order, last }: { status: (typeof WASH_PROGRESS)[number]; order: WashOrder; last: boolean }) {
  useTheme();
  const reached = order.status === 'cancelled' ? stepAt(order, status) !== null : WASH_PROGRESS.indexOf(status) <= WASH_PROGRESS.indexOf(order.status as (typeof WASH_PROGRESS)[number]);
  const current = order.status === status && status !== 'completed';
  const at = stepAt(order, status);
  return (
    <View style={{ flexDirection: 'row', gap: 12 }} accessible accessibilityLabel={`${WASH_STATUS_LABELS[status]}${reached ? (at ? `, ${formatTime(at)}` : '') : ', à venir'}`} testID={`car-wash-step-${status}`}>
      <View style={{ alignItems: 'center', width: 22 }}>
        <View style={[styles.dot, reached ? { backgroundColor: colors.accent, borderColor: colors.accent } : null, current ? styles.dotCurrent : null]}>{reached && !current ? <Check size={12} color={colors.inverse} strokeWidth={3} /> : null}</View>
        {last ? null : <View style={[styles.stem, reached ? { backgroundColor: colors.accent } : null]} />}
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

function PhotoRow({ title, photos, accountId }: { title: string; photos: WashOrder['photos']; accountId: string }) {
  useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" weight="semibold">{title}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {photos.map((p) => (
          p.uploadId ? (
            <View key={p.id} style={{ flex: 1 }}>
              <Attachment id={p.uploadId} accountId={accountId} label={photoCaption(p.label)} />
            </View>
          ) : (
            // One element for screen readers: the photo and its caption are announced once.
            <View key={p.id} style={{ flex: 1, gap: 4 }} accessible accessibilityRole="image" accessibilityLabel={photoCaption(p.label)}>
              <Image source={p.stage === 'before' ? mockPhotos.carWashBefore : mockPhotos.carWashAfter} style={styles.photo} resizeMode="cover" />
              <Text variant="micro" tone="muted" numberOfLines={1}>{photoCaption(p.label)}</Text>
            </View>
          )
        ))}
      </View>
    </View>
  );
}

function RatingBlock({ order, onDone }: { order: WashOrder; onDone: () => void }) {
  useTheme();
  const api = useApi();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (order.rating) {
    return (
      <Card style={{ gap: 6 }} testID="car-wash-rated">
        <Text variant="label" weight="semibold">Merci pour votre note</Text>
        <Stars value={order.rating.stars} />
        {order.rating.comment ? <Text variant="caption" tone="muted">{order.rating.comment}</Text> : null}
      </Card>
    );
  }
  const send = async () => {
    setBusy(true);
    try {
      await api.carWash.rate(order.id, stars, comment.trim() || null);
      haptic.success();
      onDone();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ gap: 12 }} testID="car-wash-rating">
      <Text variant="label" weight="semibold">Comment s’est passé le lavage ?</Text>
      <Stars value={stars} onChange={setStars} />
      <FormField label="Un commentaire (facultatif)" value={comment} onChangeText={setComment} maxLength={500} multiline />
      <Button label="Envoyer la note" disabled={!stars} disabledReason={stars ? undefined : 'Choisissez une note.'} loading={busy} onPress={send} testID="car-wash-rate" />
    </Card>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole={onChange ? 'adjustable' : undefined} accessibilityLabel={`Note : ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star size={30} color={n <= value ? colors.accent : colors.line} fill={n <= value ? colors.accent : 'transparent'} />;
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
  const cancel = useSingleFlight(
    async (_v: void, key: string) => api.carWash.cancel(order.id, { reasonCode: reason, reasonText: reason === 'other' ? other.trim() || undefined : undefined, acknowledgedFee: preview.data?.fee ?? 0 }, key),
    {
      onSuccess: () => {
        haptic.success();
        toast('Lavage annulé');
        onCancelled();
      },
      onError: (e) => {
        haptic.error();
        preview.refetch();
        cancel.reset();
        toast(errorMessage(e), 'danger');
      },
    },
  );
  const fee = preview.data?.fee ?? 0;
  return (
    <Sheet visible={visible} onClose={onClose} title="Annuler le lavage ?" subtitle={preview.data?.explanation} testID="car-wash-cancel-sheet">
      <View style={{ gap: 12 }}>
        {preview.isLoading ? <Skeleton height={48} /> : null}
        {preview.data ? <StatusBanner tone={fee > 0 ? 'warning' : 'success'} title={fee > 0 ? `Frais d’annulation : ${formatMoney(fee)}` : 'Annulation gratuite'} message={preview.data.freeUntil ? `jusqu’à ${formatTime(preview.data.freeUntil)}` : order.paymentMethod.kind === 'driver_wallet' ? `${formatMoney(order.terms.price - fee)} remboursés sur votre portefeuille` : undefined} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityLabel="Motif">
          {WASH_CANCEL_REASONS.map((r) => (
            <Pill key={r.code} label={r.label} selected={reason === r.code} onPress={() => setReason(r.code)} testID={`car-wash-reason-${r.code}`} />
          ))}
        </View>
        {reason === 'other' ? <FormField label="Motif" value={other} onChangeText={setOther} maxLength={200} /> : null}
        <Button label={fee > 0 ? `Annuler · ${formatMoney(fee)} de frais` : 'Annuler sans frais'} variant="danger" full loading={cancel.isPending} disabled={!preview.data || preview.data.reason === 'not_cancellable'} onPress={() => cancel.run()} testID="car-wash-cancel-confirm" />
        <Button label="Garder mon lavage" variant="ghost" full onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    entry: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background },
    pkg: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
    pkgOn: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.selected },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
    dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    dotCurrent: { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 6 },
    stem: { width: 2, flex: 1, minHeight: 14, backgroundColor: colors.line },
    photo: { width: '100%', aspectRatio: mockPhotoAspect, borderRadius: 14, backgroundColor: colors.map },
  }),
);
