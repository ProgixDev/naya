import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Baby, Camera, Check, ChevronRight, FlaskConical, Home, ImageIcon, MapPin, Minus, Pencil, Plus, School, ShieldCheck, Trash2, UserRound, Users } from 'lucide-react-native';
import { useApi } from '@naya/api/react';
import { errorMessage } from '@naya/api';
import {
  FAMILY_STATUS_LABELS,
  FAMILY_TRIP_KINDS,
  RECIPIENT_RELATIONSHIPS,
  SUBSCRIPTION_STATUS_LABELS,
  casablancaLocalToUtc,
  formatMoney,
  formatShort,
  toCasablancaParts,
  type AuthorizedRecipient,
  type FamilyChild,
  type FamilyOverview,
  type FamilyTrip,
  type FamilyTripKind,
  type Place,
} from '@naya/domain';
import { colors, getColorScheme } from '@naya/tokens';
import { useTheme } from '../core/theme';
import { Screen } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button } from '../Button';
import { FormField, Pill } from '../Form';
import { StatusBanner, ErrorState } from '../Feedback';
import { PressableScale } from '../PressableScale';
import { Sheet } from '../BottomSheet';
import { toast } from '../Toast';
import { haptic } from '../haptics';
import { pickFile, uploadFile } from './uploads';
import { FamilyStatusChip, FamilyTripCard, cityPlaces, demoKey, familyCard, schoolOf, type CityPlaces } from './prototype';

/* ───────── Data ───────── */

/** Family overview (children, subscription, trips), polled while a screen is open. */
export function useFamily(accountId: string) {
  const api = useApi();
  const qc = useQueryClient();
  const queryKey = ['naya', accountId, 'family'];
  const family = useQuery({ queryKey, queryFn: api.prototype.family, refetchInterval: 4000 });
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await qc.invalidateQueries({ queryKey });
      return true;
    } catch (e) {
      toast(errorMessage(e), 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { family, data: family.data as FamilyOverview | undefined, busy, run };
}

function useFamilyPlaces(accountId: string, cityId?: string): CityPlaces {
  const api = useApi();
  const q = useQuery({ queryKey: ['naya', accountId, 'family-places', cityId], queryFn: () => api.places.search('', cityId!), enabled: !!cityId });
  return cityPlaces(q.data);
}

/* ───────── Shared pieces ───────── */

function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4 }}>
      <Text weight="semibold" tone="muted" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' }}>{children}</Text>
      {right}
    </View>
  );
}

function Tile({ children, bg }: { children: ReactNode; bg?: string }) {
  useTheme();
  return <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: bg ?? colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

function Row({ icon, title, subtitle, onPress, testID, accent, trailing }: { icon: ReactNode; title: string; subtitle?: string; onPress?: () => void; testID?: string; accent?: boolean; trailing?: ReactNode }) {
  useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} disabled={!onPress} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')} style={[familyCard(), { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 14, paddingRight: 16 }]}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold" tone={accent ? 'accent' : 'ink'} numberOfLines={1} style={{ fontSize: 16, lineHeight: 22 }}>{title}</Text>
        {subtitle ? <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight size={18} color={colors.muted} strokeWidth={2} /> : null)}
    </PressableScale>
  );
}

function AddRow({ title, subtitle, onPress, testID }: { title: string; subtitle?: string; onPress: () => void; testID?: string }) {
  useTheme();
  return (
    <PressableScale testID={testID} onPress={() => { haptic.tap(); onPress(); }} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={title} style={{ minHeight: 72, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.mauve, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Tile><Plus size={20} color={colors.accent} strokeWidth={2.2} /></Tile>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold" tone="accent" style={{ fontSize: 16, lineHeight: 22 }}>{title}</Text>
        {subtitle ? <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{subtitle}</Text> : null}
      </View>
    </PressableScale>
  );
}

/** Child photo (private upload, fetched with the session) or the initial on a soft disc. */
export function ChildAvatar({ accountId, child, photo, name, size = 46 }: { accountId: string; child?: FamilyChild; photo?: string | null; name?: string; size?: number }) {
  useTheme();
  const api = useApi();
  const id = photo !== undefined ? photo : child?.photo;
  const label = name ?? child?.firstName ?? '';
  const q = useQuery({ queryKey: ['naya', accountId, 'attachment', id], queryFn: () => api.uploadPreview(id!), enabled: !!id, staleTime: Infinity });
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden>
      {id && q.data ? (
        <Image source={{ uri: q.data.uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : label ? (
        <Text weight="bold" tone="accent" style={{ fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.5) }}>{label.charAt(0).toUpperCase()}</Text>
      ) : (
        <Baby size={Math.round(size * 0.45)} color={colors.accent} strokeWidth={1.8} />
      )}
    </View>
  );
}

const plumHero = () => ({ backgroundColor: getColorScheme() === 'dark' ? '#3A2237' : '#6B3657', borderRadius: 26, padding: 20, gap: 14 }) as const;
const onPlum = '#FFFFFF';
const onPlumSoft = 'rgba(255,255,255,0.78)';

/* ───────── Hub ───────── */

export interface FamilyNav {
  plans: () => void;
  child: (id?: string) => void;
  planTrip: () => void;
  trip: (id: string) => void;
}

/** Naya Famille home: subscription, children and trips; each opens its own screen. */
export function FamilyHubScreen({ accountId, onBack, onNotify, nav }: { accountId: string; onBack: () => void; onNotify?: (title: string) => void; nav: FamilyNav }) {
  useTheme();
  const api = useApi();
  const { family, data, busy, run } = useFamily(accountId);
  // Notify the parent of every new step or alert (not the ones already there on open).
  const seen = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    if (!data) return;
    const counts = Object.fromEntries(data.trips.map((t) => [t.id, t.notifications.length]));
    if (seen.current)
      for (const t of data.trips)
        for (const n of t.notifications.slice(seen.current[t.id] ?? t.notifications.length)) {
          toast(n.title);
          onNotify?.(n.title);
        }
    seen.current = counts;
  }, [data, onNotify]);

  const sub = data?.subscription && data.subscription.status !== 'cancelled' ? data.subscription : null;
  const children = data?.children ?? [];
  const trips = data?.trips ?? [];
  const upcoming = trips.filter((t) => t.status !== 'completed').sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
  const done = trips.filter((t) => t.status === 'completed').slice(-3).reverse();
  const canPlan = sub?.status === 'active' && children.length > 0;

  return (
    <Screen testID="family" header={<Header title="Naya Famille" onBack={onBack} />}>
      <View style={{ gap: 24, marginTop: 4 }}>
        {family.isError ? <ErrorState onRetry={() => family.refetch()} /> : null}

        {/* ── Subscription ── */}
        {sub ? (
          <View style={plumHero()} testID="family-subscription">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text weight="medium" style={{ fontSize: 13, lineHeight: 18, color: onPlumSoft }}>Votre abonnement</Text>
              <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sub.status === 'active' ? '#3F7A57' : '#8A5A12' }} />
                <Text weight="semibold" style={{ fontSize: 12, lineHeight: 16, color: sub.status === 'active' ? '#3F7A57' : '#8A5A12' }}>{SUBSCRIPTION_STATUS_LABELS[sub.status]}</Text>
              </View>
            </View>
            <Text weight="bold" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: onPlum, marginTop: -6 }}>{sub.planName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                <Text weight="bold" style={{ fontSize: 16, lineHeight: 20, color: onPlum }}>{sub.driverName.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, lineHeight: 16, color: onPlumSoft }}>Chauffeuse dédiée</Text>
                <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, color: onPlum }}>{sub.driverName}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <HeroStat value={String(sub.includedTrips)} label="trajets inclus" />
              <HeroStat value={formatShort(sub.endsAt).split(',')[0] ?? ''} label="fin de période" />
            </View>
          </View>
        ) : (
          <View style={plumHero()}>
            <Text weight="bold" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: onPlum }}>Une chauffeuse dédiée pour vos enfants</Text>
            {['Toujours la même chauffeuse, vérifiée', 'Suivi en direct et photo à l’arrivée', 'Remise uniquement aux personnes autorisées'].map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Check size={16} color={onPlum} strokeWidth={2.6} />
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: onPlum }}>{f}</Text>
              </View>
            ))}
            <PressableScale onPress={() => { haptic.tap(); nav.plans(); }} testID="family-plans" accessibilityRole="button" style={{ marginTop: 4, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20, color: '#6B3657' }}>Découvrir les offres</Text>
            </PressableScale>
          </View>
        )}
        {sub && sub.status !== 'active' ? (
          <StatusBanner compact tone="warning" title={`Abonnement ${SUBSCRIPTION_STATUS_LABELS[sub.status].toLowerCase()}`} message="aucun nouveau trajet ne peut être planifié · contactez le support Naya" />
        ) : null}

        {/* ── Trips ── */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Trajets</SectionLabel>
          {canPlan ? <Button label="Planifier un trajet" full size="major" icon={<Plus size={18} color={colors.inverse} strokeWidth={2.4} />} onPress={nav.planTrip} testID="family-plan-trip" /> : null}
          {upcoming.map((t) => (
            <TripSummary key={t.id} trip={t} child={children.find((c) => c.id === t.childId)} accountId={accountId} onPress={() => nav.trip(t.id)} />
          ))}
          {!upcoming.length ? (
            <View style={[familyCard(), { alignItems: 'center', paddingVertical: 22, gap: 4 }]}>
              <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Aucun trajet à venir</Text>
              <Text tone="muted" align="center" style={{ fontSize: 13, lineHeight: 18, maxWidth: 260 }}>
                {!sub ? 'Choisissez une offre pour planifier les trajets de vos enfants.' : !children.length ? 'Ajoutez un enfant pour planifier son premier trajet.' : 'Vos trajets familiaux apparaîtront ici.'}
              </Text>
            </View>
          ) : null}
          {done.length ? (
            <>
              <Text weight="semibold" tone="muted" style={{ fontSize: 13, lineHeight: 18, marginTop: 6, marginLeft: 4 }}>Terminés</Text>
              {done.map((t) => (
                <TripSummary key={t.id} trip={t} child={children.find((c) => c.id === t.childId)} accountId={accountId} onPress={() => nav.trip(t.id)} />
              ))}
            </>
          ) : null}
        </View>

        {/* ── Children ── */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Mes enfants</SectionLabel>
          {children.map((c) => (
            <Row
              key={c.id}
              testID={`child-${c.id}`}
              icon={<ChildAvatar accountId={accountId} child={c} />}
              title={`${c.firstName}, ${c.age} ans`}
              subtitle={`${c.school || 'École non renseignée'} · ${c.recipients.length} ${c.recipients.length > 1 ? 'personnes autorisées' : 'personne autorisée'}`}
              onPress={() => nav.child(c.id)}
            />
          ))}
          <AddRow title="Ajouter un enfant" subtitle="Photo, école et personnes autorisées" onPress={() => nav.child()} testID="family-add-child" />
        </View>

        {/* ── Trust ── */}
        <View style={[familyCard(), { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <Tile bg={colors.successSoft}><ShieldCheck size={20} color={colors.success} strokeWidth={1.9} /></Tile>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Un trajet en confiance</Text>
            <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Photo à l’arrivée, vérification de l’enfant et code de remise à 4 chiffres.</Text>
          </View>
        </View>

        <Row icon={<Tile bg={colors.warningSoft}><FlaskConical size={20} color={colors.warning} strokeWidth={1.9} /></Tile>} title="Charger l’exemple de démo" subtitle="Enfant, offre et trajet prêts à tester" onPress={() => run(api.prototype.example)} testID="family-example" trailing={busy ? <Text tone="muted" style={{ fontSize: 13 }}>…</Text> : undefined} />
      </View>
    </Screen>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text weight="bold" numeric numberOfLines={1} style={{ fontSize: 18, lineHeight: 24, color: onPlum }}>{value}</Text>
      <Text style={{ fontSize: 12, lineHeight: 16, color: onPlumSoft }}>{label}</Text>
    </View>
  );
}

export function TripSummary({ trip: t, child, accountId, onPress }: { trip: FamilyTrip; child?: FamilyChild; accountId: string; onPress: () => void }) {
  useTheme();
  const handedTo = child?.recipients.find((r) => r.id === t.recipientId);
  return (
    <PressableScale testID={`family-trip-summary-${t.id}`} onPress={() => { haptic.select(); onPress(); }} pressedScale={0.985} accessibilityRole="button" style={[familyCard(), { gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ChildAvatar accountId={accountId} child={child} name={t.childName} size={40} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{t.childName} · {FAMILY_STATUS_LABELS[t.status]}</Text>
          <Text tone="muted" numberOfLines={1} numeric style={{ fontSize: 13, lineHeight: 18 }}>{formatShort(t.pickupAt)} · {t.driverName.split(' ')[0]}</Text>
        </View>
        <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 52 }}>
        <MapPin size={14} color={colors.muted} strokeWidth={2} />
        <Text tone="muted" numberOfLines={1} style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{t.pickup.label} → {t.destination.label}</Text>
        {t.status === 'en_route' || t.status === 'in_progress' ? <FamilyStatusChip status={t.status} /> : null}
      </View>
      {t.status === 'completed' && handedTo ? <Text tone="success" weight="medium" style={{ fontSize: 13, lineHeight: 18, paddingLeft: 52 }}>Remis·e à {handedTo.name} ({handedTo.relationship})</Text> : null}
    </PressableScale>
  );
}

/* ───────── Driver hub ───────── */

/**
 * Driver "Mes familles", laid out like the passenger hub: trips (each opens its detail with the
 * step actions: depart, arrival photo, pickup check, handover code), finished trips, then the children.
 */
export function FamilyDriverScreen({ accountId, onBack, onOpenTrip }: { accountId: string; onBack: () => void; onOpenTrip: (id: string) => void }) {
  useTheme();
  const api = useApi();
  const { family, data, busy, run } = useFamily(accountId);
  const trips = (data?.trips ?? []).slice().sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
  const open = trips.filter((t) => t.status !== 'completed');
  const done = trips.filter((t) => t.status === 'completed').slice(-3).reverse();
  const childOf = (t: FamilyTrip) => data?.children.find((c) => c.id === t.childId);
  return (
    <Screen keyboard testID="family" header={<Header title="Mes familles" onBack={onBack} />}>
      <View style={{ gap: 22, marginTop: 4 }}>
        {family.isError ? <ErrorState onRetry={() => family.refetch()} /> : null}

        <View style={{ gap: 10 }}>
          <SectionLabel>Trajets</SectionLabel>
          {open.map((t) => <TripSummary key={t.id} trip={t} child={childOf(t)} accountId={accountId} onPress={() => onOpenTrip(t.id)} />)}
          {!open.length ? (
            <View style={[familyCard(), { alignItems: 'center', paddingVertical: 22, gap: 4 }]}>
              <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Aucun trajet à venir</Text>
              <Text tone="muted" align="center" style={{ fontSize: 13, lineHeight: 18, maxWidth: 260 }}>Les trajets des familles qui vous sont confiées apparaîtront ici.</Text>
            </View>
          ) : null}
        </View>

        {done.length ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Terminés</SectionLabel>
            {done.map((t) => <TripSummary key={t.id} trip={t} child={childOf(t)} accountId={accountId} onPress={() => onOpenTrip(t.id)} />)}
          </View>
        ) : null}

        {data?.children.length ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Enfants confiés</SectionLabel>
            {data.children.map((c) => (
              <Row
                key={c.id}
                icon={<ChildAvatar accountId={accountId} child={c} />}
                title={`${c.firstName}, ${c.age} ans`}
                subtitle={`${c.school || 'École non renseignée'} · ${c.recipients.length} ${c.recipients.length > 1 ? 'personnes autorisées' : 'personne autorisée'}`}
              />
            ))}
          </View>
        ) : null}

        <View style={[familyCard(), { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <Tile bg={colors.successSoft}><ShieldCheck size={20} color={colors.success} strokeWidth={1.9} /></Tile>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Un trajet en confiance</Text>
            <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Photo à l’arrivée, vérification de l’enfant, puis remise à une personne autorisée avec son code.</Text>
          </View>
        </View>
        <Row icon={<Tile bg={colors.warningSoft}><FlaskConical size={20} color={colors.warning} strokeWidth={1.9} /></Tile>} title="Charger l’exemple de démo" subtitle="Famille, enfant et trajet prêts à tester" onPress={() => run(api.prototype.example)} testID="family-example" trailing={busy ? <Text tone="muted" style={{ fontSize: 13 }}>…</Text> : undefined} />
      </View>
    </Screen>
  );
}

/* ───────── Trip detail ───────── */

export function FamilyTripScreen({ accountId, tripId, onBack, role = 'passenger' }: { accountId: string; tripId: string; onBack: () => void; role?: 'passenger' | 'driver' }) {
  useTheme();
  const { family, data, busy, run } = useFamily(accountId);
  const trip = data?.trips.find((t) => t.id === tripId);
  return (
    <Screen keyboard testID="family-trip-screen" header={<Header title={trip ? `Trajet de ${trip.childName}` : 'Trajet'} onBack={onBack} />}>
      <View style={{ marginTop: 4 }}>
        {family.isError ? <ErrorState onRetry={() => family.refetch()} /> : null}
        {trip ? (
          <FamilyTripCard trip={trip} child={data?.children.find((c) => c.id === trip.childId)} role={role} accountId={accountId} busy={busy} run={async (a) => { await run(a); }} />
        ) : data ? (
          <Text tone="muted">Ce trajet n’existe plus.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

/* ───────── Plans ───────── */

export function FamilyPlansScreen({ accountId, onBack, onDone }: { accountId: string; onBack: () => void; onDone: () => void }) {
  useTheme();
  const api = useApi();
  const { data, busy, run } = useFamily(accountId);
  const catalog = useQuery({ queryKey: ['naya', accountId, 'catalog'], queryFn: api.prototype.catalog });
  const current = data?.subscription && data.subscription.status !== 'cancelled' ? data.subscription.planId : null;
  const plans = (catalog.data?.plans ?? []).filter((p) => p.enabled);
  return (
    <Screen testID="family-plans-screen" header={<Header title="Choisir une offre" onBack={onBack} />}>
      <View style={{ gap: 14, marginTop: 4 }}>
        <Text tone="muted" style={{ fontSize: 15, lineHeight: 21, marginHorizontal: 4 }}>Chaque offre inclut une chauffeuse vérifiée, le suivi en direct et la remise sécurisée.</Text>
        {catalog.isError ? <ErrorState onRetry={() => catalog.refetch()} /> : null}
        {plans.map((p) => {
          const on = current === p.id;
          return (
            <View key={p.id} style={[familyCard(), { padding: 18, gap: 14, borderWidth: 1.5, borderColor: on ? colors.accent : 'transparent' }]} testID={`plan-${p.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="bold" style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.3 }}>{p.name}</Text>
                  <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{p.includedTrips} trajets · {p.durationDays} jours{p.dedicatedDriver ? ' · chauffeuse dédiée' : ''}</Text>
                </View>
                {on ? <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.selected, justifyContent: 'center' }}><Text weight="semibold" tone="accent" style={{ fontSize: 12, lineHeight: 16 }}>Votre offre</Text></View> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <Text weight="bold" numeric style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.8 }}>{formatMoney(p.price)}</Text>
                <Text tone="muted" style={{ fontSize: 14, lineHeight: 22 }}>/ {p.durationDays} jours</Text>
              </View>
              <View style={{ gap: 8 }}>
                {p.features.map((f) => (
                  <View key={f} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      <Check size={12} color={colors.success} strokeWidth={3} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{f}</Text>
                  </View>
                ))}
              </View>
              <Button
                label={on ? 'Offre active' : 'Activer en démo'}
                full
                disabled={on}
                loading={busy}
                onPress={async () => {
                  if (await run(() => api.prototype.subscribe(p.id, demoKey()))) {
                    haptic.success();
                    toast(`${p.name} activée`, 'success');
                    onDone();
                  }
                }}
                testID={`plan-activate-${p.id}`}
              />
            </View>
          );
        })}
        <Text tone="muted" style={{ fontSize: 13, lineHeight: 18, marginHorizontal: 4 }}>Démonstration : aucun paiement n’est débité.</Text>
      </View>
    </Screen>
  );
}

/* ───────── Child form ───────── */

type ChildInput = Omit<FamilyChild, 'id' | 'passengerId'>;
const newRecipient = (relationship = 'Mère'): AuthorizedRecipient => ({ id: demoKey(), name: '', relationship, phone: '', verificationCode: '' });

export function FamilyChildScreen({ accountId, cityId, childId, onBack, onDone }: { accountId: string; cityId?: string; childId?: string; onBack: () => void; onDone: () => void }) {
  useTheme();
  const api = useApi();
  const { data, busy, run } = useFamily(accountId);
  const places = useFamilyPlaces(accountId, cityId);
  const initial = childId ? data?.children.find((c) => c.id === childId) ?? null : null;
  const [loaded, setLoaded] = useState(!childId);
  const [name, setName] = useState('');
  const [age, setAge] = useState(8);
  const [photo, setPhoto] = useState<string | null>(null);
  const [school, setSchool] = useState('');
  const [schoolPlace, setSchoolPlace] = useState<Place>(places.school);
  const [notes, setNotes] = useState('');
  const [recipients, setRecipients] = useState<AuthorizedRecipient[]>([newRecipient()]);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (loaded || !initial) return;
    setName(initial.firstName);
    setAge(initial.age);
    setPhoto(initial.photo ?? null);
    setSchool(initial.school);
    if (initial.schoolPlace) setSchoolPlace(initial.schoolPlace);
    setNotes(initial.notes);
    setRecipients(initial.recipients.length ? initial.recipients : [newRecipient()]);
    setLoaded(true);
  }, [initial, loaded]);

  const patch = (i: number, change: Partial<AuthorizedRecipient>) => setRecipients(recipients.map((r, j) => (j === i ? { ...r, ...change } : r)));
  const addPhoto = async (source: 'camera' | 'library') => {
    setUploading(true);
    try {
      const f = await pickFile(source, { square: true, maxEdge: 768 });
      if (f === 'denied') toast('Autorisez l’accès aux photos dans les réglages.', 'danger');
      if (!f || f === 'denied') return;
      setPhoto((await uploadFile(api, f, 'support_attachment')).id);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setUploading(false);
    }
  };
  const choose = (s: 'camera' | 'library' | 'remove') => {
    setPhotoSheet(false);
    if (s === 'remove') return setPhoto(null);
    setTimeout(() => addPhoto(s), 250);
  };
  const problems = [
    !name.trim() && 'le prénom',
    recipients.some((r) => !r.name.trim()) && 'le nom de chaque personne autorisée',
    recipients.some((r) => !/^\d{4}$/.test(r.verificationCode)) && 'un code à 4 chiffres par personne',
  ].filter(Boolean) as string[];
  const save = async () => {
    const input: ChildInput = {
      firstName: name.trim(),
      age,
      photo,
      school: school.trim(),
      schoolPlace: { ...schoolPlace, label: school.trim() || schoolPlace.label },
      notes: notes.trim(),
      recipients: recipients.map((r) => ({ ...r, name: r.name.trim(), phone: r.phone?.trim() || undefined })),
    };
    const ok = await run(() => (initial ? api.prototype.updateChild(initial.id, input) : api.prototype.child(input)));
    if (ok) {
      haptic.success();
      toast(initial ? 'Fiche mise à jour' : `${input.firstName} ajouté·e`, 'success');
      onDone();
    }
  };

  return (
    <Screen
      keyboard
      testID="child-form"
      header={<Header title={initial ? `Modifier ${initial.firstName}` : 'Nouvel enfant'} onBack={onBack} />}
      footer={<Button label="Enregistrer" full size="major" loading={busy} disabled={uploading || problems.length > 0} disabledReason={problems.length ? `Indiquez ${problems.join(', ')}.` : undefined} onPress={save} testID="child-save" />}
    >
      <View style={{ gap: 24, marginTop: 4 }}>
        {/* Photo */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <PressableScale onPress={() => { haptic.select(); setPhotoSheet(true); }} accessibilityRole="button" accessibilityLabel={photo ? 'Modifier la photo' : 'Ajouter une photo'} disabled={uploading} testID="child-photo">
            <View style={{ padding: 4, borderRadius: 60, backgroundColor: colors.surface }}>
              <ChildAvatar accountId={accountId} photo={photo} name={name} size={104} />
            </View>
            <View style={{ position: 'absolute', top: 2, right: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
              {uploading ? <Text tone="inverse" style={{ fontSize: 12 }}>…</Text> : <Pencil size={14} color={colors.inverse} strokeWidth={2.2} />}
            </View>
          </PressableScale>
          <Text tone="muted" align="center" style={{ fontSize: 13, lineHeight: 18, maxWidth: 280 }}>Photo facultative, montrée uniquement à la chauffeuse dédiée pour reconnaître l’enfant.</Text>
        </View>

        {/* Identity */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Identité</SectionLabel>
          <FormField label="Prénom" value={name} onChangeText={setName} autoCapitalize="words" testID="child-name" />
          <View style={[familyCard(), { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }]}>
            <Text weight="semibold" style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>Âge</Text>
            <Stepper value={age} min={1} max={17} onChange={setAge} suffix="ans" />
          </View>
        </View>

        {/* School */}
        <View style={{ gap: 10 }}>
          <SectionLabel>École</SectionLabel>
          <FormField label="École ou destination habituelle" value={school} onChangeText={setSchool} testID="child-school" />
          <Text tone="muted" style={{ fontSize: 13, lineHeight: 18, marginHorizontal: 4 }}>Adresse</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {places.list.map((p) => (
              <Pill key={p.id} label={p.label} selected={schoolPlace.id === p.id} onPress={() => setSchoolPlace(p)} />
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Informations importantes</SectionLabel>
          <FormField label="Allergies, santé, consignes…" value={notes} onChangeText={setNotes} multiline />
        </View>

        {/* Recipients */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Personnes autorisées</SectionLabel>
          <Text tone="muted" style={{ fontSize: 13, lineHeight: 18, marginHorizontal: 4, marginTop: -2 }}>Chaque personne a un code à 4 chiffres. La chauffeuse le saisit à la remise, sans jamais le voir.</Text>
          {recipients.map((r, i) => (
            <View key={r.id} style={[familyCard(), { gap: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <UserRound size={16} color={colors.accent} strokeWidth={2} />
                </View>
                <Text weight="semibold" style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>{r.name.trim() || `Personne ${i + 1}`}</Text>
                {recipients.length > 1 ? (
                  <PressableScale onPress={() => setRecipients(recipients.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Retirer ${r.name || `la personne ${i + 1}`}`} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={18} color={colors.danger} />
                  </PressableScale>
                ) : null}
              </View>
              <FormField label="Nom" value={r.name} onChangeText={(v) => patch(i, { name: v })} autoCapitalize="words" testID={`recipient-name-${i}`} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {RECIPIENT_RELATIONSHIPS.map((rel) => (
                  <Pill key={rel} label={rel} selected={r.relationship === rel} onPress={() => patch(i, { relationship: rel })} />
                ))}
              </View>
              <FormField label="Téléphone (facultatif)" value={r.phone ?? ''} onChangeText={(v) => patch(i, { phone: v })} keyboardType="phone-pad" />
              <FormField label="Code de remise (4 chiffres)" value={r.verificationCode} onChangeText={(v) => patch(i, { verificationCode: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={4} testID={`recipient-code-${i}`} />
            </View>
          ))}
          {recipients.length < 8 ? <AddRow title="Ajouter une personne" subtitle="Grand-parent, nounou, voisin…" onPress={() => setRecipients([...recipients, newRecipient('Personne autorisée')])} /> : null}
        </View>
      </View>

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Photo de l’enfant" subtitle="Recadrée en carré.">
        <View style={{ gap: 10, paddingBottom: 8 }}>
          <Row icon={<Tile><Camera size={20} color={colors.accent} strokeWidth={1.9} /></Tile>} title="Prendre une photo" onPress={() => choose('camera')} trailing={null} />
          <Row icon={<Tile><ImageIcon size={20} color={colors.accent} strokeWidth={1.9} /></Tile>} title="Choisir dans la galerie" onPress={() => choose('library')} trailing={null} />
          {photo ? <Row icon={<Tile bg={colors.dangerSoft}><Trash2 size={20} color={colors.danger} strokeWidth={1.9} /></Tile>} title="Retirer la photo" onPress={() => choose('remove')} trailing={null} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}

function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  useTheme();
  const btn = (icon: ReactNode, next: number, label: string) => (
    <PressableScale onPress={() => { if (next >= min && next <= max) { haptic.select(); onChange(next); } }} disabled={next < min || next > max} accessibilityRole="button" accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center', opacity: next < min || next > max ? 0.4 : 1 }}>
      {icon}
    </PressableScale>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityRole="adjustable" accessibilityValue={{ min, max, now: value, text: `${value} ${suffix ?? ''}` }}>
      {btn(<Minus size={18} color={colors.accent} strokeWidth={2.4} />, value - 1, 'Diminuer')}
      <Text weight="semibold" numeric align="center" style={{ minWidth: 56, fontSize: 16, lineHeight: 22 }}>{value} {suffix}</Text>
      {btn(<Plus size={18} color={colors.accent} strokeWidth={2.4} />, value + 1, 'Augmenter')}
    </View>
  );
}

/* ───────── Plan a trip ───────── */

const KIND_ICON: Record<FamilyTripKind, typeof Home> = { home_school: School, school_home: Home, activity_home: Users, other: MapPin };
const WEEK = [
  { i: 1, short: 'L', name: 'lun.' },
  { i: 2, short: 'M', name: 'mar.' },
  { i: 3, short: 'M', name: 'mer.' },
  { i: 4, short: 'J', name: 'jeu.' },
  { i: 5, short: 'V', name: 'ven.' },
  { i: 6, short: 'S', name: 'sam.' },
  { i: 0, short: 'D', name: 'dim.' },
];
const TIMES = ['07:30', '08:00', '08:30', '12:00', '16:30', '18:00'];

export function FamilyPlanTripScreen({ accountId, cityId, onBack, onDone }: { accountId: string; cityId?: string; onBack: () => void; onDone: () => void }) {
  useTheme();
  const api = useApi();
  const { data, busy, run } = useFamily(accountId);
  const cp = useFamilyPlaces(accountId, cityId);
  const children = data?.children ?? [];
  const [childId, setChildId] = useState<string | null>(null);
  const child = children.find((c) => c.id === childId) ?? children[0];
  const [kind, setKind] = useState<FamilyTripKind>('home_school');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const days14 = Array.from({ length: 14 }, (_, i) => toCasablancaParts(new Date(Date.now() + (i + 1) * 86400000).toISOString()).date);
  const [date, setDate] = useState(days14[0]!);
  const [time, setTime] = useState('08:00');
  const [repeat, setRepeat] = useState<number[]>([1, 2, 3, 4, 5]);
  const from = pickup ?? (kind === 'school_home' ? schoolOf(child, cp) : kind === 'activity_home' ? cp.activity : cp.home);
  const to = destination ?? (kind === 'home_school' ? schoolOf(child, cp) : cp.home);
  const places = [cp.home, schoolOf(child, cp), ...cp.list].filter((p, i, all) => all.findIndex((x) => x.label === p.label) === i);
  const preset = (k: FamilyTripKind) => {
    haptic.select();
    setKind(k);
    setPickup(null);
    setDestination(null);
    setTime(k === 'home_school' ? '08:00' : k === 'school_home' ? '16:30' : k === 'activity_home' ? '18:00' : time);
  };
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const same = from.label === to.label;
  const repeatText = repeat.length === 0 ? 'Une seule fois' : repeat.length === 5 && [1, 2, 3, 4, 5].every((d) => repeat.includes(d)) ? 'Du lundi au vendredi' : `Chaque ${WEEK.filter((d) => repeat.includes(d.i)).map((d) => d.name).join(', ')}`;
  const dayLabel = (d: string) => {
    const dt = new Date(`${d}T12:00:00Z`);
    return { wd: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' }).format(dt).replace('.', ''), n: dt.getUTCDate() };
  };
  const save = async () => {
    if (!child) return;
    const ok = await run(() => api.prototype.trip({ childId: child.id, pickup: from, destination: to, pickupAt: casablancaLocalToUtc(date, time), weekdays: repeat, kind: pickup || destination ? 'other' : kind }, demoKey()));
    if (ok) {
      haptic.success();
      toast('Trajet planifié', 'success');
      onDone();
    }
  };

  return (
    <Screen
      keyboard
      testID="trip-form"
      header={<Header title="Planifier un trajet" onBack={onBack} />}
      footer={<Button label="Enregistrer le trajet" full size="major" loading={busy} disabled={!child || same || !validTime} disabledReason={same ? 'Le départ et la destination doivent être différents.' : !validTime ? 'Heure invalide (HH:MM).' : undefined} onPress={save} testID="trip-save" />}
    >
      <View style={{ gap: 24, marginTop: 4 }}>
        {children.length > 1 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Enfant</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {children.map((c) => {
                const on = child?.id === c.id;
                return (
                  <PressableScale key={c.id} onPress={() => { haptic.select(); setChildId(c.id); setPickup(null); setDestination(null); }} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, height: 48, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: on ? colors.accent : colors.line }}>
                    <ChildAvatar accountId={accountId} child={c} size={34} />
                    <Text weight="semibold" tone={on ? 'accent' : 'ink'} style={{ fontSize: 15, lineHeight: 20 }}>{c.firstName}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <SectionLabel>Type de trajet</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {(Object.keys(FAMILY_TRIP_KINDS) as FamilyTripKind[]).map((k) => {
              const on = kind === k && !pickup && !destination;
              const Icon = KIND_ICON[k];
              return (
                <PressableScale key={k} testID={`trip-kind-${k}`} onPress={() => preset(k)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ width: '48.4%', minHeight: 76, borderRadius: 18, padding: 12, gap: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: on ? colors.accent : 'transparent', shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
                  <Icon size={20} color={on ? colors.accent : colors.muted} strokeWidth={1.9} />
                  <Text weight="semibold" tone={on ? 'accent' : 'ink'} style={{ fontSize: 14, lineHeight: 19 }}>{FAMILY_TRIP_KINDS[k]}</Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Itinéraire</SectionLabel>
          <View style={[familyCard(), { gap: 14 }]}>
            <PlaceChoice label="Départ" value={from} places={places} onPick={(p) => { setPickup(p); setDestination(to); }} />
            <View style={{ height: 1, backgroundColor: colors.line }} />
            <PlaceChoice label="Arrivée" value={to} places={places} onPick={(p) => { setDestination(p); setPickup(from); }} />
          </View>
          {same ? <Text tone="danger" style={{ fontSize: 13, lineHeight: 18, marginHorizontal: 4 }}>Le départ et la destination doivent être différents.</Text> : null}
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Premier trajet</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
            {days14.map((d) => {
              const on = d === date;
              const { wd, n } = dayLabel(d);
              return (
                <PressableScale key={d} onPress={() => { haptic.select(); setDate(d); }} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={d} style={{ width: 56, height: 68, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? colors.accent : colors.surface, borderWidth: 1, borderColor: on ? colors.accent : colors.line }}>
                  <Text weight="medium" tone={on ? 'inverse' : 'muted'} style={{ fontSize: 12, lineHeight: 16, textTransform: 'capitalize' }}>{wd}</Text>
                  <Text weight="bold" numeric tone={on ? 'inverse' : 'ink'} style={{ fontSize: 18, lineHeight: 24 }}>{n}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TIMES.map((tm) => <Pill key={tm} label={tm.replace(':', 'h')} selected={time === tm} onPress={() => setTime(tm)} />)}
          </View>
          <FormField label="Heure de récupération (HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} error={validTime ? null : 'Format attendu : 08:15'} />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Répétition</SectionLabel>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {WEEK.map((d) => {
              const on = repeat.includes(d.i);
              return (
                <PressableScale key={d.i} onPress={() => { haptic.select(); setRepeat(on ? repeat.filter((x) => x !== d.i) : [...repeat, d.i]); }} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={d.name} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : colors.surface, borderWidth: 1, borderColor: on ? colors.accent : colors.line }}>
                  <Text weight="semibold" tone={on ? 'inverse' : 'ink'} style={{ fontSize: 14, lineHeight: 18 }}>{d.short}</Text>
                </PressableScale>
              );
            })}
          </View>
          <Text tone="muted" style={{ fontSize: 13, lineHeight: 18, marginHorizontal: 4 }}>{repeatText}. Le trajet suivant est créé après chaque remise.</Text>
        </View>

        {child ? (
          <View style={[familyCard(), { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <ChildAvatar accountId={accountId} child={child} size={40} />
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              <Text weight="semibold" style={{ fontSize: 14, lineHeight: 20 }}>{child.firstName}</Text> · {from.label} → {to.label} · {dayLabel(date).wd} {dayLabel(date).n} à {time.replace(':', 'h')}
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function PlaceChoice({ label, value, places, onPick }: { label: string; value: Place; places: Place[]; onPick: (p: Place) => void }) {
  useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <PressableScale onPress={() => { haptic.select(); setOpen(!open); }} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>
          {label === 'Départ' ? <Home size={17} color={colors.accent} strokeWidth={2} /> : <MapPin size={17} color={colors.accent} strokeWidth={2} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>{label}</Text>
          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{value.label}</Text>
        </View>
        <Text weight="semibold" tone="accent" style={{ fontSize: 13, lineHeight: 18 }}>{open ? 'Fermer' : 'Changer'}</Text>
      </PressableScale>
      {open ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {places.map((p) => <Pill key={p.label} label={p.label} selected={value.label === p.label} onPress={() => { onPick(p); setOpen(false); }} />)}
        </View>
      ) : null}
    </View>
  );
}
