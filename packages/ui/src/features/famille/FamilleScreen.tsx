import { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Plus } from 'lucide-react-native';
import { errorMessage, newIdempotencyKey, qk } from '@naya/api';
import type { FamilyChildView } from '@naya/domain';
import { useApi } from '@naya/api/react';
import {
  casablancaLocalToUtc,
  formatMoney,
  formatShort,
  isFamilyTripClosed,
  PLACES,
  statusA11y,
  statusPresentation,
  toCasablancaParts,
  type FamilyOverview,
  type FamilyTrip,
} from '@naya/domain';
import { colors } from '@naya/tokens';
import { useTheme } from '../../core/theme';
import { Screen } from '../../Screen';
import { Header } from '../../Header';
import { Text } from '../../Text';
import { Button } from '../../Button';
import { DateField, FormField, Pill } from '../../Form';
import { ErrorState, StatusBanner } from '../../Feedback';
import { Card, IconDisc, ListGroup, ListRow } from '../../List';
import { Icon } from '../../Icon';
import { StatusIcon } from '../../StatusIcon';
import { Sheet } from '../../BottomSheet';
import { PressableScale } from '../../PressableScale';
import { toast } from '../../Toast';
import { useSingleFlight } from '../../core/useSingleFlight';
import { activeFamilyTrip, useFamily } from './hooks';
import { ApprovalCard, ChildInitial, FamilleSection, GuardianList, HandoverCode, InviteSheet, styles, TripStatusLine } from './parts';

export interface FamilleNav {
  onBack: () => void;
  onOpenTrip: (id: string) => void;
  onOpenPlans?: () => void;
}

type Role = 'passenger' | 'driver';

/**
 * Naya Famille overview: subscription, children, live trip, upcoming trips and history.
 * One pinned primary, « Planifier un trajet » (P-42); adding a child and inviting a relative are
 * the last rows of their groups, and both forms open in sheets.
 */
export function FamilleScreen({ accountId, role, onBack, onOpenTrip, onOpenPlans }: { accountId: string; role: Role } & FamilleNav) {
  useTheme();
  const qc = useQueryClient();
  const family = useFamily(accountId);
  const [sheet, setSheet] = useState<'invite' | 'child' | 'trip' | null>(null);
  const data = family.data;
  const refresh = () => qc.invalidateQueries({ queryKey: qk.family(accountId) });
  const live = activeFamilyTrip(data);
  const upcoming = (data?.trips ?? []).filter((t) => t.status === 'scheduled');
  const history = (data?.trips ?? []).filter((t) => isFamilyTripClosed(t.status)).reverse();
  const eligible = role === 'passenger' || data?.eligibility === 'approved';
  const canPlan = role === 'passenger' && !!data?.subscription && !!data.children.length;

  return (
    <Screen
      keyboard
      // One name in both apps (D-32).
      header={<Header title="Naya Famille" subtitle={role === 'driver' ? 'Trajets enfants' : 'Une chauffeuse dédiée pour vos enfants'} onBack={onBack} />}
      footer={canPlan ? <Button label="Planifier un trajet" size="major" full onPress={() => setSheet('trip')} testID="famille-plan-trip" /> : undefined}
      testID="famille-home"
    >
      <View style={{ gap: 24 }}>
        {family.isError ? <ErrorState onRetry={() => family.refetch()} /> : null}
        {role === 'driver' && data ? <EligibilityCard eligibility={data.eligibility ?? 'not_requested'} /> : null}

        {live && eligible ? (
          <View style={{ gap: 12 }}>
            {role === 'passenger' && live.status === 'awaiting_approval' ? <ApprovalCard trip={live} accountId={accountId} /> : null}
            <TripCard trip={live} role={role} onPress={() => onOpenTrip(live.id)} />
          </View>
        ) : null}

        {role === 'passenger' ? <PassengerPlan data={data} onOpenPlans={onOpenPlans} /> : null}
        {role === 'passenger' ? <Children data={data} onAdd={() => setSheet('child')} /> : null}
        {role === 'passenger' && data?.subscription ? <GuardianList guardians={data.guardians ?? []} accountId={accountId} onInvite={() => setSheet('invite')} /> : null}

        {eligible ? (
          <FamilleSection title="Prochains trajets">
            <View style={{ gap: 12 }}>
              {upcoming.map((t) => (
                <TripCard key={t.id} trip={t} role={role} onPress={() => onOpenTrip(t.id)} />
              ))}
              {!upcoming.length ? <Text tone="muted">{role === 'driver' ? 'Aucun trajet Famille planifié.' : 'Planifiez un trajet pour votre enfant.'}</Text> : null}
            </View>
          </FamilleSection>
        ) : null}

        {history.length ? (
          <ListGroup label="Historique · journal conservé">
            {history.map((t) => (
              <ListRow
                key={t.id}
                title={`${t.childName} · ${formatShort(t.pickupAt)}`}
                subtitle={`${t.pickup.label} → ${t.destination.label}`}
                status={{ kind: 'familyTrip', state: t.status, viewer: role }}
                statusPlacement="leading"
                onPress={() => onOpenTrip(t.id)}
                testID={`famille-history-${t.id}`}
              />
            ))}
          </ListGroup>
        ) : null}
      </View>
      {role === 'passenger' ? (
        <>
          <InviteSheet visible={sheet === 'invite'} onClose={() => setSheet(null)} accountId={accountId} />
          <ChildSheet visible={sheet === 'child'} onClose={() => setSheet(null)} onSaved={refresh} />
          {data ? <TripSheet visible={sheet === 'trip'} data={data} onClose={() => setSheet(null)} onSaved={refresh} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

/** The driver's Famille agreement, worded by its state (C10). Pending is information, not a warning (R3). */
function EligibilityCard({ eligibility }: { eligibility: NonNullable<FamilyOverview['eligibility']> }) {
  useTheme();
  const approved = eligibility === 'approved';
  return (
    <StatusBanner
      kind="familleEligibility"
      state={eligibility}
      title={approved ? 'Vous êtes approuvée pour Naya Famille' : statusPresentation('familleEligibility', eligibility).label}
      message={
        approved
          ? 'Photo à la prise en charge, départ après accord du parent, photo à l’école.'
          : 'Les trajets enfants sont réservés aux chauffeuses approuvées : extrait de casier judiciaire, références, expérience avec les enfants, formation et entretien.'
      }
      testID="famille-eligibility"
    />
  );
}

/** A trip as an object card: child and time, who drives, then the state glyph and the route (C11, A33). */
function TripCard({ trip: t, role, onPress }: { trip: FamilyTrip; role: Role; onPress: () => void }) {
  useTheme();
  const who = role === 'driver' ? 'Trajet Famille' : `Avec ${t.driverName}`;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t.childName}, ${formatShort(t.pickupAt)}, ${who}, ${t.pickup.label} vers ${t.destination.label}, ${statusA11y('familyTrip', t.status, { viewer: role })}`}
      style={styles.panel}
      testID={`famille-trip-card-${t.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading" numeric>
            {t.childName} · {formatShort(t.pickupAt)}
          </Text>
          <Text variant="caption" tone="muted">
            {who}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.muted} />
      </View>
      <TripStatusLine trip={t} viewer={role} />
    </PressableScale>
  );
}

function PassengerPlan({ data, onOpenPlans }: { data: FamilyOverview | undefined; onOpenPlans?: () => void }) {
  useTheme();
  const sub = data?.subscription;
  if (!sub) {
    // Before a plan, the promise of the service lives here, not in a banner (P-43).
    return (
      <View style={styles.soft} testID="famille-no-plan">
        <Text variant="heading">Choisissez votre formule</Text>
        <Text variant="caption" tone="muted">
          Une chauffeuse dédiée, approuvée pour Naya Famille. Position en direct, photo à la prise en charge, départ seulement avec votre accord, photo à l’école.
        </Text>
        <Button label="Voir les formules" onPress={onOpenPlans} testID="famille-open-plans" />
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onOpenPlans}
      accessibilityRole="button"
      accessibilityLabel={`Votre formule : ${sub.planName}, chauffeuse dédiée ${sub.driverName}, ${sub.includedTrips} trajets, jusqu’au ${formatShort(sub.endsAt)}`}
      style={styles.panel}
      testID="famille-plan"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" tone="muted">
            Votre formule
          </Text>
          <Text variant="title">{sub.planName}</Text>
          <Text>Chauffeuse dédiée · {sub.driverName}</Text>
          <Text variant="caption" tone="muted" numeric>
            {formatMoney(sub.price)} · {sub.includedTrips} trajets · jusqu’au {formatShort(sub.endsAt)}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.muted} />
      </View>
    </PressableScale>
  );
}

/** Children with their authorised adults; « Ajouter un enfant » is the group's last row (P-42). */
function Children({ data, onAdd }: { data: FamilyOverview | undefined; onAdd: () => void }) {
  useTheme();
  return (
    <ListGroup label="Mes enfants">
      {(data?.children ?? []).map((c) => (
        <ChildRow key={c.id} child={c} />
      ))}
      {data && !data.children.length ? <ListRow title="Aucun enfant enregistré" subtitle="Ajoutez son profil et les personnes autorisées" /> : null}
      <ListRow
        title="Ajouter un enfant"
        leading={
          <IconDisc tone="accent">
            <Icon icon={Plus} size={20} tone="accent" scale={false} />
          </IconDisc>
        }
        chevron={false}
        onPress={onAdd}
        testID="famille-add-child"
      />
    </ListGroup>
  );
}

/** A child, then each authorised adult with the handover code the parent set (masked, FS-12). */
function ChildRow({ child: c }: { child: FamilyChildView }) {
  useTheme();
  return (
    <View testID={`famille-child-${c.id}`}>
      <ListRow title={`${c.firstName} · ${c.age} ans`} subtitle={c.school} leading={<ChildInitial name={c.firstName} />} />
      {c.recipients.map((r) =>
        r.verificationCode ? (
          <HandoverCode key={r.id} name={r.name} relationship={r.relationship} code={r.verificationCode} testID={`famille-code-${c.id}-${r.id}`} />
        ) : (
          <View key={r.id} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text variant="label">
              {r.name} · {r.relationship}
            </Text>
          </View>
        ),
      )}
      <View style={{ height: 8 }} />
    </View>
  );
}

type ChildInput = Omit<FamilyChildView, 'id' | 'passengerId' | 'recipients'> & { recipient: string; code: string };

function ChildSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => Promise<unknown> }) {
  useTheme();
  const api = useApi();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [school, setSchool] = useState('');
  const [notes, setNotes] = useState('');
  const [recipient, setRecipient] = useState('');
  const [code, setCode] = useState('');
  const addChild = useSingleFlight(
    (input: ChildInput) =>
      api.prototype.child({ firstName: input.firstName, age: input.age, school: input.school, notes: input.notes, recipients: [{ id: newIdempotencyKey(), name: input.recipient, relationship: 'Responsable', verificationCode: input.code }] }),
    {
      onSuccess: async () => {
        setName('');
        setAge('');
        setSchool('');
        setNotes('');
        setRecipient('');
        setCode('');
        onClose();
        toast('Enfant enregistré', 'success');
        await onSaved();
      },
      onError: (e) => toast(errorMessage(e), 'danger'),
    },
  );
  const ready = !!name.trim() && Number(age) >= 1 && Number(age) <= 17 && !!school.trim() && !!recipient.trim() && /^\d{4}$/.test(code);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!addChild.isPending}
      title="Ajouter un enfant"
      subtitle="Son profil et l’adulte autorisé à le récupérer, avec son code de remise."
      footer={
        <Button
          label="Enregistrer l’enfant"
          size="major"
          full
          disabled={!ready}
          disabledReason={ready ? undefined : 'Complétez le profil et le code à 4 chiffres'}
          loading={addChild.isPending}
          onPress={() => addChild.run({ firstName: name.trim(), age: Number(age), school: school.trim(), notes: notes.trim(), recipient: recipient.trim(), code })}
          testID="famille-child-save"
        />
      }
      testID="famille-child-sheet"
    >
      <View style={{ gap: 12 }}>
        <FormField label="Prénom" value={name} onChangeText={setName} autoCapitalize="words" />
        <FormField label="Âge" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} />
        <FormField label="École" value={school} onChangeText={setSchool} />
        <FormField label="Consignes" value={notes} onChangeText={setNotes} />
        <FormField label="Personne autorisée" value={recipient} onChangeText={setRecipient} autoCapitalize="words" />
        <FormField label="Code de remise (4 chiffres)" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={4} />
      </View>
    </Sheet>
  );
}

type TripVars = { childId: string; pickup: string; destination: string; date: string; pickupTime: string; weekdays: number[] };

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function TripSheet({ visible, data, onClose, onSaved }: { visible: boolean; data: FamilyOverview; onClose: () => void; onSaved: () => Promise<unknown> }) {
  useTheme();
  const api = useApi();
  const first = data.children[0];
  const [childId, setChildId] = useState(first?.id ?? '');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState(first?.school ?? '');
  const [date, setDate] = useState(() => toCasablancaParts(new Date(Date.now() + 86400000).toISOString()).date);
  const [pickupTime, setPickupTime] = useState('08:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  // One request per intent; the trip carries an Idempotency-Key (a retry never books it twice).
  const planTrip = useSingleFlight(
    (v: TripVars, key) =>
      api.prototype.trip(
        {
          childId: v.childId,
          pickup: { ...PLACES.hayRiad, label: v.pickup, address: v.pickup },
          destination: { ...PLACES.agdal, label: v.destination, address: v.destination },
          pickupAt: casablancaLocalToUtc(v.date, v.pickupTime),
          weekdays: v.weekdays,
        },
        key,
      ),
    {
      onSuccess: async () => {
        onClose();
        toast('Trajet planifié', 'success');
        await onSaved();
      },
      onError: (e) => toast(errorMessage(e), 'danger'),
    },
  );
  // The school is the usual destination: prefill it for the chosen child (still editable).
  const pickChild = (id: string) => {
    setChildId(id);
    const c = data.children.find((x) => x.id === id);
    if (c) setDestination(c.school);
  };
  const chosen = data.children.some((c) => c.id === childId) ? childId : (first?.id ?? '');
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime);
  const missing = !pickup.trim() || !destination.trim() ? 'Indiquez le départ et la destination' : !date ? 'Indiquez la date du départ' : !time ? 'Indiquez l’heure au format HH:MM' : undefined;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!planTrip.isPending}
      title="Planifier un trajet"
      subtitle="Le trajet suivant est créé automatiquement après chaque dépôt."
      footer={
        <Button
          label="Enregistrer le trajet"
          size="major"
          full
          disabled={!!missing || !chosen}
          disabledReason={missing}
          loading={planTrip.isPending}
          onPress={() => planTrip.run({ childId: chosen, pickup: pickup.trim(), destination: destination.trim(), date, pickupTime, weekdays: [...days].sort((a, b) => a - b) })}
          testID="famille-trip-save"
        />
      }
      testID="famille-trip-sheet"
    >
      <View style={{ gap: 12 }}>
        {data.children.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {data.children.map((c) => (
              <Pill key={c.id} label={c.firstName} selected={chosen === c.id} onPress={() => pickChild(c.id)} />
            ))}
          </View>
        ) : null}
        <FormField label="Départ" value={pickup} onChangeText={setPickup} example="Ex. : 12 rue Oued Ziz, Hay Riad" />
        <FormField label="Destination" value={destination} onChangeText={setDestination} />
        <DateField label="Date du départ" value={date} onChange={setDate} />
        <FormField label="Heure du départ" value={pickupTime} onChangeText={setPickupTime} keyboardType="numbers-and-punctuation" maxLength={5} example="Ex. : 08:00" />
        <Text variant="caption" weight="semibold">
          Répéter chaque semaine
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WEEKDAYS.map((d, i) => (
            <Pill key={d} label={d} selected={days.includes(i)} onPress={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])} />
          ))}
        </View>
      </View>
    </Sheet>
  );
}

/** Plans and subscription (the existing offers, unchanged in price and quota). */
export function FamillePlansScreen({ accountId, onBack, onSubscribed }: { accountId: string; onBack: () => void; onSubscribed?: () => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const family = useFamily(accountId);
  const catalog = useQuery({ queryKey: ['naya', accountId, 'catalog'], queryFn: api.prototype.catalog });
  const sub = family.data?.subscription;
  const active = sub && sub.status === 'active' && Date.parse(sub.endsAt) > Date.now();
  // One Idempotency-Key per plan chosen: a double tap or a retry never pays twice.
  const subscribe = useSingleFlight(({ planId }: { planId: string }, key) => api.prototype.subscribe(planId, key), {
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      toast('Formule activée', 'success');
      onSubscribed?.();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const busy = subscribe.isPending ? subscribe.variables?.planId : null;
  return (
    <Screen header={<Header title="Formules Famille" subtitle="Chauffeuse dédiée, approuvée pour les trajets enfants" onBack={onBack} />} testID="famille-plans">
      <View style={{ gap: 16 }}>
        {catalog.isError ? <ErrorState onRetry={() => catalog.refetch()} /> : null}
        {(catalog.data?.plans ?? [])
          .filter((p) => p.enabled)
          .map((p) => {
            const current = !!active && sub?.planId === p.id;
            // The current plan: a 2-pt accent outline plus the active glyph (C14), not a pill.
            return (
              <Card key={p.id} style={[{ gap: 12 }, current ? { borderWidth: 2, borderColor: colors.accent } : null]} testID={`famille-plan-${p.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text variant="title" style={{ flex: 1 }}>
                    {p.name}
                  </Text>
                  {current && sub ? <StatusIcon kind="familleSubscription" state={sub.status} testID="famille-plan-current" /> : null}
                </View>
                <View style={{ gap: 2 }}>
                  <Text variant="heading" numeric>
                    {formatMoney(p.price)} / {p.durationDays} jours
                  </Text>
                  <Text variant="caption" tone="muted" numeric>
                    {p.includedTrips} trajets inclus
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  {p.features.map((f) => (
                    <View key={f} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <View style={{ paddingTop: 1 }}>
                        <Icon icon={Check} size={16} tone="accent" />
                      </View>
                      <Text variant="label" style={{ flex: 1 }}>
                        {f}
                      </Text>
                    </View>
                  ))}
                </View>
                {!active ? <Button label="Choisir cette formule" loading={busy === p.id} disabled={!!busy && busy !== p.id} onPress={() => subscribe.run({ planId: p.id })} testID={`famille-subscribe-${p.id}`} /> : null}
              </Card>
            );
          })}
        {active ? <Text tone="muted">Votre formule est active jusqu’au {formatShort(sub!.endsAt)}. Un changement de formule sera possible à son échéance.</Text> : null}
        <Text variant="caption" tone="muted">
          Toutes les formules : position en direct chaque seconde, photo à la prise en charge, départ après votre accord, photo à l’école, bouton sécurité et appel au 19 pendant le trajet.
        </Text>
      </View>
    </Screen>
  );
}
