import { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Baby, CalendarClock, ChevronRight, History, ShieldCheck } from 'lucide-react-native';
import { errorMessage, newIdempotencyKey, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import {
  casablancaLocalToUtc,
  FAMILLE_ELIGIBILITY_LABELS,
  FAMILY_STATUS_LABELS,
  formatMoney,
  formatShort,
  isFamilyTripActive,
  isFamilyTripClosed,
  PLACES,
  toCasablancaParts,
  type FamilyOverview,
  type FamilyTrip,
} from '@naya/domain';
import { colors } from '@naya/tokens';
import { useTheme } from '../../core/theme';
import { Screen, Section } from '../../Screen';
import { Header } from '../../Header';
import { Text } from '../../Text';
import { Button } from '../../Button';
import { FormField, Pill } from '../../Form';
import { ErrorState, StatusBanner, StatusPill } from '../../Feedback';
import { IconDisc, ListGroup, ListRow } from '../../List';
import { PressableScale } from '../../PressableScale';
import { toast } from '../../Toast';
import { activeFamilyTrip, useFamily } from './hooks';
import { ApprovalCard, GuardianList, InviteSheet, styles, TripStatusLine } from './parts';

export interface FamilleNav {
  onBack: () => void;
  onOpenTrip: (id: string) => void;
  onOpenPlans?: () => void;
}

/** Naya Famille overview: subscription, children, live trip, upcoming trips and history. */
export function FamilleScreen({ accountId, role, onBack, onOpenTrip, onOpenPlans }: { accountId: string; role: 'passenger' | 'driver' } & FamilleNav) {
  useTheme();
  const qc = useQueryClient();
  const family = useFamily(accountId);
  const [busy, setBusy] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const data = family.data;
  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    try {
      const r = await action();
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      return r;
    } catch (e) {
      toast(errorMessage(e), 'danger');
      return null;
    } finally {
      setBusy(null);
    }
  };
  const live = activeFamilyTrip(data);
  const upcoming = (data?.trips ?? []).filter((t) => t.status === 'scheduled');
  const history = (data?.trips ?? []).filter((t) => isFamilyTripClosed(t.status)).reverse();
  const eligible = role === 'passenger' || data?.eligibility === 'approved';

  return (
    <Screen keyboard header={<Header title={role === 'driver' ? 'Mes familles' : 'Naya Famille'} subtitle={role === 'driver' ? 'Trajets enfants' : 'Une chauffeuse dédiée pour vos enfants'} onBack={onBack} />} testID="famille-home">
      <View style={{ gap: 18 }}>
        {family.isError ? <ErrorState onRetry={() => family.refetch()} /> : null}
        {role === 'driver' && data ? <EligibilityCard eligibility={data.eligibility ?? 'not_requested'} /> : null}
        {role === 'passenger' ? (
          <StatusBanner tone="info" icon={<ShieldCheck size={18} color={colors.info} />} title="Un trajet en confiance" message="Position en direct chaque seconde, photo de l’enfant à la prise en charge, départ seulement avec votre accord, photo à l’école." />
        ) : null}

        {live && eligible ? (
          <View style={{ gap: 10 }}>
            {role === 'passenger' && live.status === 'awaiting_approval' ? <ApprovalCard trip={live} accountId={accountId} /> : null}
            <TripCard trip={live} role={role} onPress={() => onOpenTrip(live.id)} highlight />
          </View>
        ) : null}

        {role === 'passenger' ? <PassengerPlan data={data} onOpenPlans={onOpenPlans} /> : null}
        {role === 'passenger' ? <ChildrenAndPlanning data={data} busy={busy} run={run} /> : null}
        {role === 'passenger' && data?.subscription ? (
          <View style={{ gap: 10 }}>
            <GuardianList guardians={data.guardians ?? []} accountId={accountId} />
            <Button label="Inviter l’autre parent à suivre" variant="secondary" full onPress={() => setInvite(true)} testID="famille-invite-open" />
          </View>
        ) : null}

        {eligible ? (
          <Section title="Prochains trajets">
            <View style={{ gap: 10 }}>
              {upcoming.map((t) => (
                <TripCard key={t.id} trip={t} role={role} onPress={() => onOpenTrip(t.id)} />
              ))}
              {!upcoming.length ? <Text tone="muted">{role === 'driver' ? 'Aucun trajet Famille planifié.' : 'Planifiez un trajet pour votre enfant.'}</Text> : null}
            </View>
          </Section>
        ) : null}

        {history.length ? (
          <ListGroup label="Historique · journal conservé">
            {history.map((t) => (
              <ListRow key={t.id} title={`${t.childName} · ${FAMILY_STATUS_LABELS[t.status]}`} subtitle={`${formatShort(t.pickupAt)} · ${t.pickup.label} → ${t.destination.label}`} leading={<IconDisc><History size={18} color={colors.accent} /></IconDisc>} onPress={() => onOpenTrip(t.id)} testID={`famille-history-${t.id}`} />
            ))}
          </ListGroup>
        ) : null}
      </View>
      {role === 'passenger' ? <InviteSheet visible={invite} onClose={() => setInvite(false)} accountId={accountId} /> : null}
    </Screen>
  );
}

function EligibilityCard({ eligibility }: { eligibility: NonNullable<FamilyOverview['eligibility']> }) {
  useTheme();
  const approved = eligibility === 'approved';
  return (
    <StatusBanner
      tone={approved ? 'success' : eligibility === 'rejected' ? 'danger' : eligibility === 'pending' ? 'warning' : 'info'}
      title={`Éligibilité Naya Famille : ${FAMILLE_ELIGIBILITY_LABELS[eligibility].toLowerCase()}`}
      message={
        approved
          ? 'Vous pouvez recevoir des trajets enfants. Photo à la prise en charge, départ après accord du parent, photo à l’école.'
          : 'Les trajets enfants sont réservés aux chauffeuses approuvées : extrait de casier judiciaire, références, expérience avec les enfants, formation et entretien.'
      }
      testID="famille-eligibility"
    />
  );
}

function TripCard({ trip: t, role, onPress, highlight }: { trip: FamilyTrip; role: 'passenger' | 'driver'; onPress: () => void; highlight?: boolean }) {
  useTheme();
  const tone = t.status === 'awaiting_approval' ? 'warning' : isFamilyTripActive(t.status) ? 'info' : 'neutral';
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t.childName}, ${FAMILY_STATUS_LABELS[t.status]}`} style={[styles.panel, highlight ? { borderWidth: 1, borderColor: colors.accent } : null]} testID={`famille-trip-card-${t.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <StatusPill tone={tone} label={FAMILY_STATUS_LABELS[t.status]} />
          <Text variant="heading">
            {t.childName} · {formatShort(t.pickupAt)}
          </Text>
          <Text variant="caption" tone="muted">
            {role === 'driver' ? 'Trajet Famille' : `Avec ${t.driverName}`}
          </Text>
        </View>
        <ChevronRight size={22} color={colors.ink} />
      </View>
      <TripStatusLine trip={t} />
    </PressableScale>
  );
}

function PassengerPlan({ data, onOpenPlans }: { data: FamilyOverview | undefined; onOpenPlans?: () => void }) {
  useTheme();
  const sub = data?.subscription;
  if (!sub) {
    return (
      <View style={styles.soft} testID="famille-no-plan">
        <Text variant="heading">Choisissez votre formule</Text>
        <Text variant="caption" tone="muted">
          Une chauffeuse dédiée, approuvée pour Naya Famille, pour les trajets école et activités.
        </Text>
        <Button label="Voir les formules" onPress={onOpenPlans} testID="famille-open-plans" />
      </View>
    );
  }
  return (
    <PressableScale onPress={onOpenPlans} accessibilityRole="button" style={styles.panel} testID="famille-plan">
      <Text variant="caption" tone="accent">
        Votre formule
      </Text>
      <Text variant="title">{sub.planName}</Text>
      <Text>Chauffeuse dédiée · {sub.driverName}</Text>
      <Text variant="caption" tone="muted">
        {formatMoney(sub.price)} · {sub.includedTrips} trajets · jusqu’au {formatShort(sub.endsAt)}
      </Text>
    </PressableScale>
  );
}

function ChildrenAndPlanning({ data, busy, run }: { data: FamilyOverview | undefined; busy: string | null; run: (label: string, a: () => Promise<unknown>) => Promise<unknown> }) {
  useTheme();
  const api = useApi();
  const [childForm, setChildForm] = useState(false);
  const [tripForm, setTripForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [school, setSchool] = useState('');
  const [notes, setNotes] = useState('');
  const [recipient, setRecipient] = useState('');
  const [code, setCode] = useState('');
  const [childId, setChildId] = useState('');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(() => toCasablancaParts(new Date(Date.now() + 86400000).toISOString()).date);
  const [pickupTime, setPickupTime] = useState('08:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const childReady = !!name.trim() && Number(age) >= 1 && Number(age) <= 17 && !!school.trim() && !!recipient.trim() && /^\d{4}$/.test(code);
  // The school is the usual destination: prefill it for the chosen child (still editable).
  const pickChild = (id: string) => {
    setChildId(id);
    const c = data?.children.find((x) => x.id === id);
    if (c) setDestination(c.school);
  };
  return (
    <>
      <ListGroup label="Mes enfants">
        {(data?.children ?? []).map((c) => (
          <ListRow key={c.id} title={`${c.firstName} · ${c.age} ans`} subtitle={`${c.school} · ${c.recipients.map((r) => r.name).join(', ')}`} leading={<IconDisc><Baby size={18} color={colors.accent} /></IconDisc>} />
        ))}
        {!data?.children.length ? <ListRow title="Aucun enfant enregistré" subtitle="Ajoutez son profil et les personnes autorisées" /> : null}
      </ListGroup>
      <Button label="Ajouter un enfant" variant="secondary" onPress={() => setChildForm(!childForm)} />
      {childForm ? (
        <View style={styles.panel}>
          <FormField label="Prénom" value={name} onChangeText={setName} autoCapitalize="words" />
          <FormField label="Âge" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} />
          <FormField label="École" value={school} onChangeText={setSchool} />
          <FormField label="Consignes" value={notes} onChangeText={setNotes} />
          <FormField label="Personne autorisée" value={recipient} onChangeText={setRecipient} autoCapitalize="words" />
          <FormField label="Code de remise (4 chiffres)" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={4} />
          <Button
            label="Enregistrer l’enfant"
            disabled={!childReady}
            disabledReason={childReady ? undefined : 'Complétez le profil et le code à 4 chiffres'}
            loading={busy === 'child'}
            onPress={() =>
              run('child', async () => {
                await api.prototype.child({ firstName: name, age: Number(age), school, notes, recipients: [{ id: newIdempotencyKey(), name: recipient, relationship: 'Responsable', verificationCode: code }] });
                setChildForm(false);
              })
            }
          />
        </View>
      ) : null}
      {data?.subscription && data.children.length ? (
        <Button
          label="Planifier un trajet"
          icon={<CalendarClock size={17} color={colors.inverse} />}
          onPress={() => {
            pickChild(childId || data.children[0]!.id);
            setTripForm(!tripForm);
          }}
        />
      ) : null}
      {tripForm ? (
        <View style={styles.panel}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {data?.children.map((c) => (
              <Pill key={c.id} label={c.firstName} selected={childId === c.id} onPress={() => pickChild(c.id)} />
            ))}
          </View>
          <FormField label="Départ" value={pickup} onChangeText={setPickup} placeholder="Adresse de prise en charge" />
          <FormField label="Destination" value={destination} onChangeText={setDestination} />
          <FormField label="Date du départ (AAAA-MM-JJ)" value={date} onChangeText={setDate} />
          <FormField label="Heure du départ (HH:MM)" value={pickupTime} onChangeText={setPickupTime} />
          <Text variant="caption">Répéter chaque semaine</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, i) => (
              <Pill key={d} label={d} selected={days.includes(i)} onPress={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])} />
            ))}
          </View>
          <Text variant="caption" tone="muted">
            Le trajet suivant est créé automatiquement après chaque dépôt.
          </Text>
          <Button
            label="Enregistrer le trajet"
            disabled={!pickup.trim() || !destination.trim()}
            disabledReason={!pickup.trim() || !destination.trim() ? 'Indiquez le départ et la destination' : undefined}
            loading={busy === 'trip'}
            onPress={() =>
              run('trip', async () => {
                await api.prototype.trip(
                  {
                    childId,
                    pickup: { ...PLACES.hayRiad, label: pickup.trim(), address: pickup.trim() },
                    destination: { ...PLACES.agdal, label: destination.trim(), address: destination.trim() },
                    pickupAt: casablancaLocalToUtc(date, pickupTime),
                    weekdays: days,
                  },
                  newIdempotencyKey(),
                );
                setTripForm(false);
              })
            }
          />
        </View>
      ) : null}
    </>
  );
}

/** Plans and subscription (the existing offers, unchanged in price and quota). */
export function FamillePlansScreen({ accountId, onBack, onSubscribed }: { accountId: string; onBack: () => void; onSubscribed?: () => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const family = useFamily(accountId);
  const catalog = useQuery({ queryKey: ['naya', accountId, 'catalog'], queryFn: api.prototype.catalog });
  const [busy, setBusy] = useState<string | null>(null);
  const sub = family.data?.subscription;
  const active = sub && sub.status === 'active' && Date.parse(sub.endsAt) > Date.now();
  const subscribe = async (planId: string) => {
    setBusy(planId);
    try {
      await api.prototype.subscribe(planId, newIdempotencyKey());
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      toast('Formule activée', 'success');
      onSubscribed?.();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Screen header={<Header title="Formules Famille" subtitle="Chauffeuse dédiée, approuvée pour les trajets enfants" onBack={onBack} />} testID="famille-plans">
      <View style={{ gap: 16 }}>
        {catalog.isError ? <ErrorState onRetry={() => catalog.refetch()} /> : null}
        {(catalog.data?.plans ?? [])
          .filter((p) => p.enabled)
          .map((p) => {
            const current = active && sub?.planId === p.id;
            return (
              <View key={p.id} style={[styles.panel, current ? { borderWidth: 2, borderColor: colors.accent } : null]} testID={`famille-plan-${p.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text variant="title" style={{ flex: 1 }}>
                    {p.name}
                  </Text>
                  {current ? <StatusPill tone="success" label="Votre formule" /> : null}
                </View>
                <Text variant="heading" numeric>
                  {formatMoney(p.price)} / {p.durationDays} jours
                </Text>
                <Text variant="caption" tone="muted">
                  {p.includedTrips} trajets inclus
                </Text>
                {p.features.map((f) => (
                  <Text key={f} variant="label">
                    • {f}
                  </Text>
                ))}
                {!active ? <Button label="Choisir cette formule" loading={busy === p.id} onPress={() => subscribe(p.id)} testID={`famille-subscribe-${p.id}`} /> : null}
              </View>
            );
          })}
        {active ? <Text tone="muted">Votre formule est active jusqu’au {formatShort(sub!.endsAt)}. Un changement de formule sera possible à son échéance.</Text> : null}
        <Text variant="caption" tone="muted">
          Toutes les formules : position en direct chaque seconde, photo à la prise en charge, départ après votre accord, photo à l’école, appel WhatsApp et police en un geste.
        </Text>
      </View>
    </Screen>
  );
}
