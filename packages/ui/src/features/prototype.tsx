import { Attachment } from './Attachment';
import { useTheme } from './../core/theme';
import { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { errorMessage } from '@naya/api';
import {
  FAMILY_STATUS_LABELS,
  PLACES,
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
/** All emergency actions are simulated and remain inside the demo. */
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
  const [contact, setContact] = useState('Contact de confiance');
  const [busy, setBusy] = useState(false);
  const run = async (action?: string) => {
    setBusy(true);
    try {
      setAlert(
        action && alert
          ? await api.prototype.safetyAction(alert.id, action)
          : await api.prototype.sos(
              { rideId, familyTripId, location, contactName: contact },
              key(),
            ),
      );
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        label="SOS · sécurité"
        variant="secondary"
        onPress={() => setOpen(true)}
        testID="sos"
      />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="SOS · démonstration"
        subtitle="Les appels et les envois sont simulés."
      >
        <View style={{ gap: 12 }}>
          <StatusBanner
            tone="warning"
            title="Tester une alerte"
            message="La position et les actions apparaîtront dans le back-office de démonstration."
          />
          <Text variant="caption" numeric>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </Text>
          {!alert ? (
            <>
              <FormField
                label="Contact de confiance"
                value={contact}
                onChangeText={setContact}
              />
              <Button
                label="Confirmer l’alerte de démo"
                loading={busy}
                onPress={() => run()}
                testID="confirm-sos"
              />
            </>
          ) : (
            <>
              <StatusBanner
                tone="success"
                title={`Alerte ${alert.id} enregistrée`}
                message="Position jointe · disponible dans le back-office."
              />
              {[
                'Appel urgence simulé',
                'Position partagée (simulation)',
                'Contact de confiance alerté (simulation)',
                'Support contacté (simulation)',
              ].map((action) => (
                <Button
                  key={action}
                  label={action}
                  variant="secondary"
                  loading={busy}
                  onPress={() => run(action)}
                />
              ))}
              {alert.actions.map((a, i) => (
                <Text key={i} variant="caption">
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
  const catalog = useQuery({
    queryKey: ['naya', accountId, 'catalog'],
    queryFn: api.prototype.catalog,
  });
  const [amount, setAmount] = useState('100');
  const [provider, setProvider] = useState('demo-mobile');
  const [busy, setBusy] = useState(false);
  const run = async (id?: string, outcome?: 'confirmed' | 'failed') => {
    setBusy(true);
    try {
      if (id && outcome) await api.prototype.resolveTopup(id, outcome);
      else
        await api.prototype.topup(
          Math.round(Number(amount.replace(',', '.')) * 100),
          provider,
          key(),
        );
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
            {(catalog.data?.payments ?? [])
              .filter(
                (p) =>
                  p.enabled &&
                  (!p.cityIds.length || p.cityIds.includes(cityId)),
              )
              .map((p) => (
                <Pill
                  key={p.id}
                  label={p.name}
                  selected={provider === p.id}
                  onPress={() => setProvider(p.id)}
                />
              ))}
            <Button
              label="Créer la recharge de démo"
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
                  {e.amount > 0 && e.status === 'pending' ? (
                    <View style={{ gap: 8 }}>
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

export function FamilyScreen({
  accountId,
  role,
  onBack,
}: {
  accountId: string;
  role: 'passenger' | 'driver';
  onBack: () => void;
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
  const [busy, setBusy] = useState(false);
  const [childForm, setChildForm] = useState(false);
  const [tripForm, setTripForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('8');
  const [school, setSchool] = useState('');
  const [notes, setNotes] = useState('');
  const [recipient, setRecipient] = useState('');
  const [code, setCode] = useState('');
  const [childId, setChildId] = useState('');
  const [pickup, setPickup] = useState('Hay Riad');
  const [destination, setDestination] = useState('École Agdal');
  const [date, setDate] = useState(
    () => toCasablancaParts(new Date(Date.now() + 86400000).toISOString()).date,
  );
  const [pickupTime, setPickupTime] = useState('08:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
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
              : 'Une chauffeuse dédiée, les étapes du trajet et les personnes autorisées réunies ici.'
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
            {data?.subscription ? (
              <View style={panel}>
                <Text variant="title">{data.subscription.planName}</Text>
                <Text>Chauffeuse dédiée · {data.subscription.driverName}</Text>
                <Text variant="caption" tone="muted">
                  {data.subscription.includedTrips} trajets · jusqu’au{' '}
                  {formatShort(data.subscription.endsAt)}
                </Text>
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
                  title={`${c.firstName} · ${c.age} ans`}
                  subtitle={`${c.school} · ${c.recipients.map((r) => r.name).join(', ')}`}
                />
              ))}
            </ListGroup>
            <Button
              label="Ajouter un enfant"
              variant="secondary"
              onPress={() => setChildForm(!childForm)}
            />
            {childForm ? (
              <View style={panel}>
                <FormField label="Prénom" value={name} onChangeText={setName} />
                <FormField
                  label="Âge"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                />
                <FormField
                  label="École"
                  value={school}
                  onChangeText={setSchool}
                />
                <FormField
                  label="Consignes"
                  value={notes}
                  onChangeText={setNotes}
                />
                <FormField
                  label="Personne autorisée"
                  value={recipient}
                  onChangeText={setRecipient}
                />
                <FormField
                  label="Code de remise (4 chiffres)"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Button
                  label="Enregistrer l’enfant"
                  loading={busy}
                  onPress={() =>
                    run(async () => {
                      await api.prototype.child({
                        firstName: name,
                        age: Number(age),
                        school,
                        notes,
                        recipients: [
                          {
                            id: key(),
                            name: recipient,
                            relationship: 'Responsable',
                            verificationCode: code,
                          },
                        ],
                      });
                      setChildForm(false);
                    })
                  }
                />
              </View>
            ) : null}
            {data?.subscription && data.children.length ? (
              <Button
                label="Planifier un trajet"
                onPress={() => {
                  setChildId(data.children[0]!.id);
                  setTripForm(!tripForm);
                }}
              />
            ) : null}
            {tripForm ? (
              <View style={panel}>
                {data?.children.map((c) => (
                  <Pill
                    key={c.id}
                    label={c.firstName}
                    selected={childId === c.id}
                    onPress={() => setChildId(c.id)}
                  />
                ))}
                <FormField
                  label="Départ"
                  value={pickup}
                  onChangeText={setPickup}
                />
                <FormField
                  label="Destination"
                  value={destination}
                  onChangeText={setDestination}
                />
                <FormField
                  label="Date du départ (AAAA-MM-JJ)"
                  value={date}
                  onChangeText={setDate}
                />
                <FormField
                  label="Heure du départ (HH:MM)"
                  value={pickupTime}
                  onChangeText={setPickupTime}
                />
                <Text variant="caption">Répéter chaque semaine</Text>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(
                    (d, i) => (
                      <Pill
                        key={d}
                        label={d}
                        selected={days.includes(i)}
                        onPress={() =>
                          setDays(
                            days.includes(i)
                              ? days.filter((x) => x !== i)
                              : [...days, i],
                          )
                        }
                      />
                    ),
                  )}
                </View>
                <Text variant="caption" tone="muted">
                  Adresses et positions de démonstration · prochain trajet créé
                  après chaque remise.
                </Text>
                <Button
                  label="Enregistrer le trajet"
                  loading={busy}
                  onPress={() =>
                    run(async () => {
                      await api.prototype.trip(
                        {
                          childId,
                          pickup: {
                            ...PLACES.hayRiad,
                            label: pickup,
                            address: pickup,
                          },
                          destination: {
                            ...PLACES.agdal,
                            label: destination,
                            address: destination,
                          },
                          pickupAt: casablancaLocalToUtc(date, pickupTime),
                          weekdays: days,
                        },
                        key(),
                      );
                      setTripForm(false);
                    })
                  }
                />
              </View>
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
function FamilyTripCard({
  trip: t,
  child,
  role,
  busy,
  run,
}: {
  trip: FamilyTrip;
  child?: FamilyChild;
  role: 'passenger' | 'driver';
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  useTheme();
  const api = useApi();
  const [name, setName] = useState('');
  const [recipient, setRecipient] = useState(child?.recipients[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [incident, setIncident] = useState('');
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
  return (
    <View style={{ ...panel, backgroundColor: colors.surface }}>
      <Text variant="title">
        {t.childName} · {FAMILY_STATUS_LABELS[t.status]}
      </Text>
      <Text variant="caption" tone="muted">
        {formatShort(t.pickupAt)} · {t.driverName}
      </Text>
      <Text>
        {t.pickup.label} → {t.destination.label}
      </Text>
      <View style={{ height: 180, borderRadius: 18, overflow: 'hidden' }}>
        <NayaMap
          center={t.location}
          route={[t.pickup.location, t.location, t.destination.location]}
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
      {child ? (
        <Text variant="caption" tone="muted">
          {child.age} ans · {child.school} · {child.notes}
        </Text>
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
              label="Partir vers l’enfant"
              loading={busy}
              onPress={() => advance()}
            />
          ) : null}
          {t.status === 'en_route' ? (
            <>
              <Button
                label="Photo d’arrivée (simulation)"
                loading={busy}
                onPress={() => advance({ proof: 'demo-arrival-photo' })}
              />
              <Button
                label="Prendre une photo d’arrivée"
                variant="secondary"
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
            </>
          ) : null}
          {t.status === 'arrived' ? (
            <>
              <FormField
                label="Prénom de l’enfant vérifié"
                value={name}
                onChangeText={setName}
              />
              <Button
                label="Confirmer la prise en charge"
                loading={busy}
                onPress={() => advance({ childName: name })}
              />
            </>
          ) : null}
          {t.status === 'picked_up' ? (
            <Button
              label="Démarrer le trajet"
              loading={busy}
              onPress={() => advance()}
            />
          ) : null}
          {t.status === 'in_progress' ? (
            <>
              {child?.recipients.map((r) => (
                <Pill
                  key={r.id}
                  label={`${r.name} · ${r.relationship}`}
                  selected={recipient === r.id}
                  onPress={() => setRecipient(r.id)}
                />
              ))}
              <FormField
                label="Code de remise"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={4}
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
                label="Confirmer la remise"
                loading={busy}
                onPress={() => advance({ recipientId: recipient, code })}
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
            label="Signaler à la famille"
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
          title="Remise confirmée"
          message="Le prochain trajet récurrent apparaît dans la liste."
        />
      )}
      <Text variant="label">Journal et notifications</Text>
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
    </View>
  );
}
