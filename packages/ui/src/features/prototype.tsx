import { Attachment } from './Attachment';
import { useTheme } from './../core/theme';
import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Platform, Pressable, Share, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { errorMessage } from '@naya/api';
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
import { colors } from '@naya/tokens';
import { Screen, Section } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button } from '../Button';
import { FormField, Pill } from '../Form';
import { StatusBanner, ErrorState } from '../Feedback';
import { ListGroup, ListRow } from '../List';
import { Sheet } from '../BottomSheet';
import { toast } from '../Toast';
import { NayaMap } from '../map';
import { pickFile, uploadFile } from './uploads';
import { haptic } from '../haptics';
import { PaymentInstructionsCard, ProviderIcon, providerSubtitle, sandboxLabel } from './payments';

const key = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
}: {
  accountId: string;
  cityId: string;
  onBack: () => void;
}) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ['naya', accountId, 'passenger-wallet'];
  const wallet = useQuery({ queryKey, queryFn: api.prototype.wallet });
  const providers = useQuery({
    queryKey: ['naya', accountId, 'recharge-providers', cityId],
    queryFn: api.prototype.rechargeProviders,
  });
  const [amount, setAmount] = useState('100');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = providers.data?.find((p) => p.id === providerId) ?? providers.data?.[0];
  const run = async (id?: string, outcome?: 'confirmed' | 'failed') => {
    setBusy(true);
    try {
      if (id && outcome) await api.prototype.resolveTopup(id, outcome);
      else {
        if (!chosen) throw new Error('Choisissez un moyen de recharge.');
        if (chosen.needsPhone && !phone.trim()) throw new Error('Indiquez le numéro associé à votre wallet.');
        await api.prototype.topup(
          Math.round(Number(amount.replace(',', '.')) * 100),
          chosen.id,
          key(),
          chosen.needsPhone ? phone.trim() : undefined,
        );
      }
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      keyboard
      header={<Header title="Portefeuille Naya" onBack={onBack} />}
    >
      <View style={{ gap: 16 }}>
        <StatusBanner
          tone="info"
          title="Paiements de démonstration"
          message="Aucun argent réel n’est débité. Confirmez ou refusez une recharge pour tester son résultat."
        />
        {wallet.isError ? (
          <ErrorState onRetry={() => wallet.refetch()} />
        ) : null}
        <View style={{ ...panel, backgroundColor: colors.selected }}>
          <Text variant="caption" tone="accent">
            Solde disponible
          </Text>
          <Text variant="display">
            {formatMoney(
              (wallet.data?.balance ?? 0) - (wallet.data?.reserved ?? 0),
            )}
          </Text>
          <Text variant="caption" tone="muted">
            {formatMoney(wallet.data?.reserved ?? 0)} réservés pour vos courses
          </Text>
        </View>
        <Section title="Recharger">
          <View style={{ gap: 12 }}>
            <FormField
              label="Montant (MAD)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            {providers.data && !providers.data.length ? (
              <StatusBanner compact tone="warning" title="Aucun moyen de recharge" message="aucun prestataire n’est activé dans votre ville" />
            ) : null}
            <View accessibilityRole="radiogroup" accessibilityLabel="Moyen de recharge">
              <ListGroup>
                {(providers.data ?? []).map((p) => (
                  <ListRow
                    key={p.id}
                    testID={`topup-provider-${p.kind}`}
                    title={p.name}
                    subtitle={providerSubtitle(p)}
                    leading={<ProviderIcon kind={p.kind} />}
                    trailing={chosen?.id === p.id ? <Text tone="accent" weight="semibold">✓</Text> : undefined}
                    onPress={() => setProviderId(p.id)}
                  />
                ))}
              </ListGroup>
            </View>
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
            <Button
              label={chosen ? `Recharger via ${chosen.name}` : 'Recharger'}
              loading={busy}
              onPress={() => run()}
              testID="wallet-topup"
            />
          </View>
        </Section>
        <Section title="Opérations">
          <View style={{ gap: 12 }}>
            {wallet.data?.entries
              .slice()
              .reverse()
              .map((e) => (
                <View key={`${e.id}-${e.status}`} style={panel}>
                  <Text variant="label">{e.label}</Text>
                  <Text variant="caption" tone="muted">
                    {formatShort(e.at)} ·{' '}
                    {e.status === 'confirmed'
                      ? 'Confirmée'
                      : e.status === 'pending'
                        ? 'En attente'
                        : 'Refusée / libérée'}
                  </Text>
                  <Text variant="title">{formatMoney(e.amount)}</Text>
                  {e.amount > 0 ? <PaymentInstructionsCard op={e} /> : null}
                  {e.status === 'failed' && e.failureReason ? (
                    <Text variant="caption" tone="danger">{e.failureReason}</Text>
                  ) : null}
                  {e.amount > 0 && e.status === 'pending' ? (
                    <View style={{ gap: 8 }}>
                      <Text variant="micro" tone="muted">{sandboxLabel(e.flow)} :</Text>
                      <Button
                        label="Simuler la confirmation"
                        loading={busy}
                        onPress={() => run(e.id, 'confirmed')}
                      />
                      <Button
                        label="Simuler le refus"
                        variant="secondary"
                        loading={busy}
                        onPress={() => run(e.id, 'failed')}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
          </View>
        </Section>
      </View>
    </Screen>
  );
}

/** Addresses offered for child trips: places of the parent's city from the API (any city added in the back-office). */
type CityPlaces = { home: Place; list: Place[]; school: Place; activity: Place };
function cityPlaces(found?: Place[]): CityPlaces {
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
const schoolOf = (c: FamilyChild | undefined, places: CityPlaces) =>
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

function FamilyTripCard({
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
  return (
    <View style={{ ...panel, backgroundColor: colors.surface }} testID={`family-trip-${t.id}`}>
      <Text variant="title">
        {t.childName} · {FAMILY_STATUS_LABELS[t.status]}
      </Text>
      <Text variant="caption" tone="muted">
        {t.kind ? `${FAMILY_TRIP_KINDS[t.kind]} · ` : ''}
        {formatShort(t.pickupAt)} · {t.driverName}
      </Text>
      <Text>
        {t.pickup.label} → {t.destination.label}
      </Text>
      {t.vehicle ? (
        <Text variant="caption" tone="muted">
          {t.vehicle.make} {t.vehicle.model} · {t.vehicle.color} · {t.vehicle.plate}
        </Text>
      ) : null}
      {t.stoppedAt ? (
        <StatusBanner compact tone="warning" title="Véhicule à l’arrêt" message="La famille est prévenue en cas d’arrêt prolongé." />
      ) : null}
      <View style={{ height: 180, borderRadius: 18, overflow: 'hidden' }}>
        <NayaMap
          center={t.location}
          route={t.route ?? [t.pickup.location, t.destination.location]}
          fitTo={[t.pickup.location, t.destination.location]}
          markers={[
            { id: 'pickup', kind: 'pickup', coordinate: t.pickup.location },
            {
              id: 'destination',
              kind: 'destination',
              coordinate: t.destination.location,
            },
            { id: 'driver', kind: 'driver', coordinate: t.location },
          ]}
        />
      </View>
      {live ? (
        <Text variant="caption" tone="accent">
          Position en direct (démo) · mise à jour toutes les 4 secondes
        </Text>
      ) : null}
      {child ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          {child.photo ? <Attachment id={child.photo} accountId={accountId} label={`Photo de ${child.firstName}`} /> : null}
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label">{child.firstName} · {child.age} ans</Text>
            <Text variant="caption" tone="muted">{child.school}</Text>
            {child.notes ? <Text variant="caption">{child.notes}</Text> : null}
          </View>
        </View>
      ) : null}
      {role === 'passenger' && t.status !== 'completed' ? (
        <Button label={`Contacter ${driverFirstName}`} variant="secondary" onPress={() => setContact(true)} testID="family-contact" />
      ) : null}
      {t.status !== 'completed' ? (
        <>
          {role === 'passenger' ? (
            <Text variant="caption" tone="accent">
              Simuler les étapes de la chauffeuse
            </Text>
          ) : null}
          {t.status === 'scheduled' ? (
            <Button
              label="Je pars chercher l’enfant"
              loading={busy}
              onPress={() => advance()}
              testID="family-depart"
            />
          ) : null}
          {t.status === 'en_route' ? (
            <>
              <Text variant="caption" tone="muted">
                À l’arrivée, une photo du point de récupération est envoyée au parent.
              </Text>
              <Button
                label="Prendre une photo d’arrivée"
                loading={busy}
                onPress={() =>
                  run(async () => {
                    const f = await pickFile('camera');
                    if (!f || f === 'denied') return;
                    const u = await uploadFile(api, f, 'support_attachment');
                    await api.prototype.advance(t.id, {
                      expectedStatus: t.status,
                      proof: u.id,
                    });
                  })
                }
              />
              <Button
                label="Photo d’arrivée (simulation)"
                variant="secondary"
                loading={busy}
                onPress={() => advance({ proof: 'demo-arrival-photo' })}
                testID="family-arrived"
              />
            </>
          ) : null}
          {t.status === 'arrived' ? (
            <>
              <Text variant="caption" tone="muted">
                Vérifiez l’enfant avec sa photo, puis saisissez son prénom.
              </Text>
              <FormField
                label="Prénom de l’enfant vérifié"
                value={name}
                onChangeText={setName}
                testID="family-child-name"
              />
              <Button
                label="Enfant récupéré"
                loading={busy}
                onPress={() => advance({ childName: name })}
                testID="family-picked-up"
              />
            </>
          ) : null}
          {t.status === 'picked_up' ? (
            <Button
              label="Démarrer le trajet"
              loading={busy}
              onPress={() => advance()}
              testID="family-start"
            />
          ) : null}
          {t.status === 'in_progress' ? (
            <>
              <Text variant="label">Remise à une personne autorisée</Text>
              {child?.recipients.map((r) => (
                <Pill
                  key={r.id}
                  label={`${r.name} · ${r.relationship}${r.phone ? ` · ${r.phone}` : ''}`}
                  selected={recipient === r.id}
                  onPress={() => setRecipient(r.id)}
                />
              ))}
              <FormField
                label="Code donné par la personne"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={4}
                testID="family-code"
              />
              {role === 'passenger' ? (
                <Text variant="caption" tone="muted">
                  Code démo à communiquer :{' '}
                  {
                    child?.recipients.find((r) => r.id === recipient)
                      ?.verificationCode
                  }
                </Text>
              ) : null}
              <Button
                label="Confirmer l’arrivée et la remise"
                loading={busy}
                onPress={() => advance({ recipientId: recipient, code })}
                testID="family-complete"
              />
              <Button
                label={t.stoppedAt ? 'Reprendre le trajet (démo)' : 'Simuler un arrêt inhabituel (démo)'}
                variant="ghost"
                loading={busy}
                onPress={() => run(() => api.prototype.stop(t.id, !t.stoppedAt))}
                testID="family-stop"
              />
            </>
          ) : null}
          <SafetyButton familyTripId={t.id} location={t.location} />
          <FormField
            label="Retard ou incident"
            value={incident}
            onChangeText={setIncident}
          />
          <Button
            label={role === 'driver' ? 'Signaler à la famille' : 'Signaler à Naya'}
            variant="secondary"
            loading={busy}
            disabled={!incident.trim()}
            onPress={() =>
              run(async () => {
                await api.prototype.incident(t.id, incident);
                setIncident('');
              })
            }
          />
        </>
      ) : (
        <StatusBanner
          compact
          tone="success"
          title={handedTo ? `Remis·e à ${handedTo.name} (${handedTo.relationship})` : 'Remise confirmée'}
          message="Le prochain trajet récurrent apparaît dans la liste."
        />
      )}
      {role === 'passenger' && t.notifications.length ? (
        <>
          <Text variant="label">Notifications</Text>
          {t.notifications
            .slice()
            .reverse()
            .map((n, i) => (
              <Text key={i} variant="caption" numeric>
                {formatShort(n.at)} · {n.title}
              </Text>
            ))}
        </>
      ) : null}
      <Text variant="label">Traçabilité</Text>
      {STEP_TIMES.map(([step, label]) =>
        t.times?.[step] ? (
          <Text key={step} variant="caption" tone="muted" numeric>
            {label} · {formatShort(t.times[step]!)}
          </Text>
        ) : null,
      )}
      {(t.incidents ?? []).map((x, i) => (
        <Text key={i} variant="caption" tone="danger" numeric>
          {formatShort(x.at)} · {x.source === 'auto' ? 'Alerte automatique' : x.by} · {x.message}
        </Text>
      ))}
      <Text variant="caption" tone="muted">Journal GPS</Text>
      {t.timeline.map((e, i) => (
        <Text key={i} variant="caption" tone="muted" numeric>
          {formatShort(e.at)} · {e.label} · {e.location.lat.toFixed(4)},{' '}
          {e.location.lng.toFixed(4)}
          {e.proof ? ' · preuve jointe' : ''}
        </Text>
      ))}
      {t.arrivalProof && t.arrivalProof !== 'demo-arrival-photo' ? (
        <Attachment
          id={t.arrivalProof}
          accountId={role === 'driver' ? t.driverId : t.passengerId}
          label="Photo d’arrivée"
        />
      ) : null}
      {t.arrivalProof ? (
        <Text variant="caption" tone="accent">
          {t.arrivalProof === 'demo-arrival-photo'
            ? 'Photo d’arrivée simulée'
            : 'Photo d’arrivée enregistrée'}
        </Text>
      ) : null}
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
