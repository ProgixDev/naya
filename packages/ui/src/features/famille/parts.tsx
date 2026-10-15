import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Image, Linking, Platform, Share, StyleSheet, View } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import Svg, { Circle } from 'react-native-svg';
import {
  Camera,
  CalendarClock,
  CarFront,
  CircleCheck,
  CircleSlash,
  Dot,
  Eye,
  EyeOff,
  MapPin,
  MapPinCheck,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  School,
  Send,
  ShieldCheck,
  ShieldQuestionMark,
  ShieldX,
  Signal,
  TimerOff,
  TriangleAlert,
  UserPlus,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import {
  formatDistance,
  formatTime,
  FAMILY_APPROVAL_TIMEOUT_SECONDS,
  FAMILY_DEMO_PROOFS,
  haversineMeters,
  type FamilyLive,
  type FamilyNotification,
  type FamilyProof,
  type FamilyTimelineEntry,
  type FamilyTimelineKind,
  type FamilyTrip,
  type LatLng,
  type Place,
  type StatusTone,
} from '@naya/domain';
import { mockPhotos } from '@naya/assets';
import { colors, radius, themedStyles } from '@naya/tokens';
import { useTheme } from '../../core/theme';
import { DEMO_MODE } from '../../core/apiBase';
import { useA11yPrefs } from '../../a11y';
import { SectionTitle, Text } from '../../Text';
import { Button } from '../../Button';
import { StatusBanner } from '../../Feedback';
import { FormField } from '../../Form';
import { ListGroup, ListRow } from '../../List';
import { Icon } from '../../Icon';
import { StatusIcon } from '../../StatusIcon';
import { Sheet } from '../../BottomSheet';
import { PressableScale } from '../../PressableScale';
import { toast } from '../../Toast';
import { useSingleFlight } from '../../core/useSingleFlight';
import { NayaMap } from '../../map';
import { useAnimatedCoordinate } from '../../map/useAnimatedCoordinate';
import { Attachment } from '../Attachment';

export const styles = themedStyles(() => ({
  // An object card (a trip, a plan): radius 22, hairline edge, padding 20 (audit §5.5).
  panel: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  soft: { backgroundColor: colors.selected, borderRadius: radius.card, padding: 20, gap: 10 },
  mapBox: { borderRadius: 22, overflow: 'hidden' as const, backgroundColor: colors.map },
  // Stacked in the top-left corner, clear of the map attribution at the bottom (FS-14).
  chips: { position: 'absolute' as const, left: 10, right: 10, top: 10, alignItems: 'flex-start' as const, gap: 6 },
  chip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, maxWidth: '100%' as const, paddingHorizontal: 10, paddingVertical: 4, minHeight: 28, borderRadius: 14, backgroundColor: colors.surface },
  codeChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.selected },
  srOnly: { position: 'absolute' as const, width: 1, height: 1, overflow: 'hidden' as const, opacity: 0 },
  photo: { width: 132, height: 99, borderRadius: 14, backgroundColor: colors.mauveSoft },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.selected, alignItems: 'center' as const, justifyContent: 'center' as const },
}));

/* ───────────── Live map ───────────── */

/** The chauffeuse's position, refreshed every second and interpolated between fixes. */
export function FamilleLiveMap({ trip, live, height = 240, testID }: { trip: Pick<FamilyTrip, 'pickup' | 'destination' | 'status' | 'location'>; live: FamilyLive | undefined; height?: number; testID?: string }) {
  useTheme();
  const { reduceMotion } = useA11yPrefs();
  const target = live?.location ?? trip.location;
  const animated = useAnimatedCoordinate(target, reduceMotion, 950) ?? target;
  const markers = useMemo(
    () => [
      { id: 'pickup', kind: 'pickup' as const, coordinate: trip.pickup.location, label: trip.pickup.label },
      { id: 'destination', kind: 'destination' as const, coordinate: trip.destination.location, label: trip.destination.label },
      ...(trip.status !== 'completed' && trip.status !== 'cancelled' ? [{ id: 'driver', kind: 'driver' as const, coordinate: animated, heading: live?.heading ?? undefined }] : []),
    ],
    [trip.pickup, trip.destination, trip.status, animated, live?.heading],
  );
  const fit = useMemo(() => [trip.pickup.location, trip.destination.location, ...(live?.leg === 'to_pickup' ? [live.route[0]!] : [])], [trip.pickup.location, trip.destination.location, live?.leg, live?.route]);
  const moving = live?.leg === 'to_pickup' || live?.leg === 'to_school';
  return (
    <View style={[styles.mapBox, { height }]} testID={testID}>
      <NayaMap center={target} route={live?.route ?? [trip.pickup.location, trip.destination.location]} fitTo={fit} markers={markers} />
      {moving && live ? (
        // No live region: the age changes every second (FS-14). The ETA is read from LiveFacts.
        <View style={styles.chips} pointerEvents="none">
          {live.source === 'gps' && live.stale ? (
            // A stale fix is a problem: its own glyph and word, never a colour change alone (C20).
            <View style={[styles.chip, { backgroundColor: colors.warningSoft }]} testID="famille-live-stale">
              <Icon icon={WifiOff} size={16} tone="warning" />
              <Text variant="caption" weight="semibold" numeric style={{ flexShrink: 1, color: colors.warning }} testID="famille-live-age">
                Position en attente · il y a {live.ageSeconds} s
              </Text>
            </View>
          ) : (
            <View style={styles.chip}>
              <Icon icon={Signal} size={16} tone={live.source === 'gps' ? 'success' : 'accent'} />
              <Text variant="caption" weight="semibold" numeric style={{ flexShrink: 1 }} testID="famille-live-age">
                {live.source === 'gps' ? `GPS · il y a ${live.ageSeconds} s` : 'Position · chaque seconde'}
              </Text>
            </View>
          )}
          {live.etaSeconds != null ? (
            <View style={styles.chip} testID="famille-live-eta-chip">
              <Icon icon={live.leg === 'to_pickup' ? MapPin : School} size={16} tone="accent" />
              <Text variant="caption" weight="semibold" numeric style={{ flexShrink: 1 }}>
                {live.leg === 'to_pickup' ? 'Prise en charge' : 'École'} dans {formatEta(live.etaSeconds)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const formatEta = (s: number) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);

export function LiveFacts({ live }: { live: FamilyLive | undefined }) {
  useTheme();
  if (!live || (live.leg !== 'to_pickup' && live.leg !== 'to_school')) return null;
  return (
    <Text variant="label" tone="accent" weight="semibold" numeric testID="famille-eta">
      {live.leg === 'to_pickup' ? 'Arrivée au point de prise en charge' : 'Arrivée à l’école'} dans {formatEta(live.etaSeconds ?? 0)} · {formatDistance(live.remainingMeters)}
    </Text>
  );
}

/* ───────────── Proofs and timeline ───────────── */

export function ProofPhoto({ proof, accountId, label }: { proof: FamilyProof | null | undefined; accountId: string; label: string }) {
  useTheme();
  if (!proof) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" weight="semibold">
        {label} · {formatTime(proof.at)}
      </Text>
      {proof.simulated ? (
        // No upload behind this proof (mock chauffeuse, or a device without a camera): the mock photo.
        <Image source={proof.uploadId === FAMILY_DEMO_PROOFS.dropoff ? mockPhotos.familleDropoff : mockPhotos.famillePickup} style={styles.photo} resizeMode="cover" accessible accessibilityRole="image" accessibilityLabel={label} />
      ) : (
        <Attachment id={proof.uploadId} accountId={accountId} label={label} />
      )}
    </View>
  );
}

/**
 * One glyph per kind of journal line, shared by the parent, the chauffeuse and the follow link
 * (audit P-64, A19). Problems keep their state glyph (C12); calls use `Phone` (§2.2).
 */
const KIND_GLYPH: Record<FamilyTimelineKind, { icon: LucideIcon; tone: StatusTone }> = {
  planned: { icon: CalendarClock, tone: 'info' },
  departed: { icon: CarFront, tone: 'accent' },
  arrived: { icon: MapPinCheck, tone: 'accent' },
  pickup_photo: { icon: Camera, tone: 'accent' },
  start_requested: { icon: ShieldQuestionMark, tone: 'info' },
  start_approved: { icon: ShieldCheck, tone: 'success' },
  start_refused: { icon: ShieldX, tone: 'danger' },
  start_expired: { icon: TimerOff, tone: 'warning' },
  live_started: { icon: Navigation, tone: 'accent' },
  dropoff_photo: { icon: Camera, tone: 'accent' },
  completed: { icon: CircleCheck, tone: 'success' },
  cancelled: { icon: CircleSlash, tone: 'neutral' },
  call: { icon: Phone, tone: 'accent' },
  call_request: { icon: MessageCircle, tone: 'info' },
  police: { icon: Phone, tone: 'danger' },
  invite: { icon: Send, tone: 'info' },
  incident: { icon: TriangleAlert, tone: 'warning' },
};

/** Where a journal line happened, by name: the pick-up or the school when it is close to one of them (P-64). */
const PLACE_RADIUS_METERS = 250;
export function placeNameNear(location: LatLng | undefined, places: Pick<Place, 'label' | 'location'>[]): string | null {
  if (!location) return null;
  let best: { label: string; d: number } | null = null;
  for (const p of places) {
    const d = haversineMeters(location, p.location);
    if (d <= PLACE_RADIUS_METERS && (!best || d < best.d)) best = { label: p.label, d };
  }
  return best?.label ?? null;
}

/**
 * Server lines shown as written, except: the « simulation » / « (démo) » markers of lines written
 * before 14 Oct 2026, and the « invité·e » the server still writes for a co-parent (FS-15).
 */
export const familyLabel = (label: string) =>
  label
    .replace(/ · simulation$/, '')
    .replace(/ \((?:simulée|démo)\)/g, '')
    .replace(' · joué par le parent', ' · saisi depuis le compte parent')
    .replace('un trajet de démonstration', 'un nouveau trajet')
    .replace(/ invité·e à suivre les trajets/g, ' · invitation à suivre les trajets');

/**
 * What the parent's phone shows for a trip notification. The server still writes « X est prête »
 * and « X est arrivée · Déposée à … » for every child: replaced by wording that fits any child (FS-15).
 */
export function familyNotificationCopy(n: Pick<FamilyNotification, 'kind' | 'title' | 'body'>, trip: Pick<FamilyTrip, 'childName' | 'destination'>): { title: string; body: string } {
  if (n.kind === 'approval_request') return { title: `Départ de ${trip.childName} à approuver`, body: n.body ?? '' };
  if (n.kind === 'status' && n.body?.startsWith('Déposée à ')) return { title: `Dépôt confirmé · ${trip.childName}`, body: `${trip.destination.label} · photo jointe.` };
  return { title: familyLabel(n.title), body: familyLabel(n.body ?? '') };
}

/** A section with a level-2 heading: the screen header stays the only level-1 heading (FS-14). */
export function FamilleSection({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  useTheme();
  return (
    <View style={{ marginTop: 12, gap: 12 }} testID={testID}>
      <SectionTitle variant="heading" aria-level={2}>
        {title}
      </SectionTitle>
      {children}
    </View>
  );
}

const ANNOUNCE_DEDUPE_MS = 5_000;
let lastAnnounced: { message: string; at: number } = { message: '', at: 0 };

/**
 * Says a phase change once to screen readers (VoiceOver, TalkBack, or a polite live region on
 * the web), never each tick of a countdown (FS-14).
 */
export function PhaseAnnouncer({ message }: { message: string | null }) {
  useTheme();
  useEffect(() => {
    if (!message || Platform.OS === 'web') return;
    // The same card can be mounted twice (Famille home under the trip screen): say it once.
    const now = Date.now();
    if (lastAnnounced.message === message && now - lastAnnounced.at < ANNOUNCE_DEDUPE_MS) return;
    lastAnnounced = { message, at: now };
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  if (Platform.OS !== 'web') return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
      {message ?? ''}
    </Text>
  );
}

type TimelineTrip = Pick<FamilyTrip, 'pickup' | 'destination'> & {
  timeline: (Pick<FamilyTimelineEntry, 'at' | 'label' | 'kind'> & Partial<Pick<FamilyTimelineEntry, 'location' | 'proof'>>)[];
};

/**
 * Every step of the trip, timestamped (kept in the history once the trip closes). Each line has
 * its kind's glyph and the place by name, never raw coordinates (P-64).
 */
export function FamilleTimeline({ trip, testID }: { trip: TimelineTrip; testID?: string }) {
  useTheme();
  const places = [trip.pickup, trip.destination];
  return (
    <View style={{ gap: 14 }} testID={testID}>
      {trip.timeline.map((e, i) => {
        const g = e.kind ? KIND_GLYPH[e.kind] : undefined;
        const place = placeNameNear(e.location, places);
        return (
          <View key={`${e.at}-${i}`} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 24, alignItems: 'center', paddingTop: 1 }}>
              <Icon icon={g?.icon ?? Dot} size={20} tone={g?.tone ?? 'neutral'} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{familyLabel(e.label)}</Text>
              <Text variant="caption" tone="muted" numeric>
                {formatTime(e.at)}
                {place ? ` · ${place}` : ''}
                {e.proof ? ' · photo jointe' : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ───────────── Parent approval ───────────── */

type ApprovalVars = { approvalId: string; decision: 'approve' | 'refuse'; mode: 'on_site' | 'remote'; reason?: string };

/** « 2 min 05 s »: the time left to answer, in tabular figures. */
export const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;

/** The whole answer window of a request, from the server's own timestamps. */
export const approvalWindowSeconds = (a: { requestedAt: string; expiresAt: string } | null | undefined) => {
  const s = a ? Math.round((Date.parse(a.expiresAt) - Date.parse(a.requestedAt)) / 1000) : NaN;
  return Number.isFinite(s) && s > 0 ? s : FAMILY_APPROVAL_TIMEOUT_SECONDS;
};

/**
 * The approval state glyph (`ShieldQuestionMark`, C12) inside the time left as a ring, like the
 * driver's offer countdown (P-65). The ring turns red in the last 30 s. Hidden from screen readers:
 * the countdown line next to it carries the time.
 */
export function ApprovalRing({ seconds, total, size = 56 }: { seconds: number; total: number; size?: 44 | 56 }) {
  useTheme();
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / total));
  const urgent = seconds <= 30;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="famille-approval-ring">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.warningSoft} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={urgent ? colors.danger : colors.warning} strokeWidth={stroke} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Icon icon={ShieldQuestionMark} size={size === 56 ? 28 : 20} tone={urgent ? 'danger' : 'warning'} scale={false} />
    </View>
  );
}

/**
 * The start gate. The parent sees the pick-up photo and answers on site or remotely;
 * without an answer before the server deadline the request expires and nothing moves.
 * The card sits on the trip and on Famille home; elsewhere in the app the request is a banner
 * that opens this card in a sheet (P-62), never a route change. `embedded` drops the card frame
 * inside that sheet.
 */
export function ApprovalCard({ trip, accountId, onDone, embedded = false }: { trip: FamilyTrip; accountId: string; onDone?: () => void; embedded?: boolean }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const approval = trip.approval;
  const { seconds, expired } = useDeadline(approval?.status === 'pending' ? approval.expiresAt : null, 500);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
  // One Idempotency-Key per answer: a double tap or a retry after a timeout replays it.
  const answer = useSingleFlight(({ approvalId, decision, mode, reason: why }: ApprovalVars, key) => api.prototype.approveStart(trip.id, { decision, mode, approvalId, reason: why }, key), {
    onSuccess: async (_t, v) => {
      toast(v.decision === 'approve' ? 'Départ approuvé' : 'Départ refusé · la chauffeuse est prévenue', v.decision === 'approve' ? 'success' : undefined);
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      onDone?.();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const pending = !!approval && approval.status === 'pending';
  const driverFirst = trip.driverName.split(' ')[0];
  const phase = !pending ? null : expired ? 'Demande de départ expirée. Le trajet ne démarre pas.' : seconds <= 30 ? 'Moins de 30 secondes pour répondre à la demande de départ.' : `${driverFirst} demande à démarrer. Vérifiez la photo puis répondez.`;
  if (!approval || !pending) return null;
  const busy = answer.isPending ? `${answer.variables?.decision}-${answer.variables?.mode}` : null;
  const send = (decision: 'approve' | 'refuse', mode: 'on_site' | 'remote') => answer.run({ approvalId: approval.id, decision, mode, ...(decision === 'refuse' && reason.trim() ? { reason: reason.trim() } : {}) });
  return (
    <View style={embedded ? { gap: 12 } : styles.panel} testID="famille-approval">
      <View style={[styles.row, { gap: 14 }]}>
        <ApprovalRing seconds={expired ? 0 : seconds} total={approvalWindowSeconds(approval)} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" accessibilityRole="header" aria-level={2}>
            {driverFirst} demande à démarrer
          </Text>
          <Text variant="label" weight="semibold" tone={expired || seconds <= 30 ? 'danger' : 'ink'} numeric testID="famille-approval-countdown">
            {expired ? 'Demande expirée' : `Répondez dans ${formatCountdown(seconds)}`}
          </Text>
        </View>
      </View>
      <PhaseAnnouncer message={phase} />
      <ProofPhoto proof={trip.pickupPhoto} accountId={accountId} label={`Photo de ${trip.childName} à la prise en charge`} />
      <Text variant="caption" tone="muted">
        Vérifiez la photo. Sans votre accord, le trajet ne démarre pas.
      </Text>
      <Button label="Je suis sur place · j’approuve" size="major" full loading={busy === 'approve-on_site'} disabled={expired || !!busy} onPress={() => send('approve', 'on_site')} testID="famille-approve-onsite" />
      <Button label="Approuver à distance" variant="secondary" full loading={busy === 'approve-remote'} disabled={expired || !!busy} onPress={() => send('approve', 'remote')} testID="famille-approve-remote" />
      {refusing ? (
        <View style={{ gap: 8 }}>
          <FormField label="Motif (facultatif)" value={reason} onChangeText={setReason} example="Ex. : je viens chercher mon enfant moi-même" />
          <Button label="Confirmer le refus" variant="danger" full loading={busy === 'refuse-remote'} disabled={expired || !!busy} onPress={() => send('refuse', 'remote')} testID="famille-refuse-confirm" />
        </View>
      ) : (
        <Button label="Refuser le départ" variant="ghost" full disabled={expired || !!busy} onPress={() => setRefusing(true)} testID="famille-refuse" />
      )}
    </View>
  );
}

/* ───────────── Handover codes (parent only) ───────────── */

const REVEAL_MS = 15_000;

/**
 * A handover code the parent set, masked until she taps it, then masked again after 15 s
 * (FS-12). Only the parent's payload carries codes: the chauffeuse's never does.
 */
export function HandoverCode({ name, relationship, code, testID }: { name: string; relationship: string; code: string; testID?: string }) {
  useTheme();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(false), REVEAL_MS);
    return () => clearTimeout(id);
  }, [shown]);
  return (
    <View style={[styles.row, { paddingHorizontal: 16, paddingVertical: 8 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">
          {name} · {relationship}
        </Text>
        <Text variant="caption" tone="muted">
          Code de remise
        </Text>
      </View>
      <PressableScale
        onPress={() => setShown((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={shown ? `Code de remise de ${name} : ${code.split('').join(' ')}` : `Code de remise de ${name}, masqué`}
        accessibilityHint={shown ? 'Masque le code' : 'Affiche le code pendant 15 secondes'}
        style={styles.codeChip}
        testID={testID}
      >
        <Text variant="label" weight="semibold" numeric testID={testID ? `${testID}-value` : undefined}>
          {shown ? code : '••••'}
        </Text>
        {shown ? <EyeOff size={16} color={colors.accent} /> : <Eye size={16} color={colors.accent} />}
      </PressableScale>
    </View>
  );
}

/* ───────────── Calls and invites ───────────── */

/**
 * Calls and the co-parent invite, as rows. The WhatsApp hand-off is not live in mock builds, so
 * its row is hidden there (owner decision R8). The 19 call and SOS sit behind the one safety
 * button and its sheet (P-63), not here. Every hand-off goes through a confirmation sheet.
 */
export function FamilleContactBar({ trip, role, accountId }: { trip: FamilyTrip; role: 'passenger' | 'driver'; accountId: string }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<'whatsapp' | 'invite' | null>(null);
  const driverFirst = trip.driverName.split(' ')[0] ?? trip.driverName;
  const refresh = () => qc.invalidateQueries({ queryKey: qk.family(accountId) });
  const calls = !DEMO_MODE;

  // One request per confirmation. These routes take no Idempotency-Key in the API client yet.
  const whatsapp = useSingleFlight(
    async ({ tripId }: { tripId: string }) => {
      if (role === 'driver') {
        await api.prototype.requestFamilyCall(tripId);
        toast('Demande envoyée · le parent confirme puis vous appelle');
        return;
      }
      const r = await api.prototype.familyCall(tripId, 'whatsapp');
      // An account without a real number: the call is noted on the trip, WhatsApp is not opened.
      if (r.simulated) toast(`Appel vers ${r.counterpartName} noté sur le trajet`);
      else {
        const app = r.appUrl && (await Linking.canOpenURL(r.appUrl).catch(() => false));
        await Linking.openURL(app ? r.appUrl! : r.url);
      }
    },
    {
      onSuccess: async () => {
        setSheet(null);
        await refresh();
      },
      onError: (e) => toast(errorMessage(e), 'danger'),
    },
  );
  const busy = whatsapp.isPending;
  if (!calls && role !== 'passenger') return null;

  return (
    <>
      <ListGroup>
        {calls ? (
          <ListRow
            title={role === 'driver' ? 'Demander un appel au parent' : `Appeler ${driverFirst} sur WhatsApp`}
            leading={<Icon icon={MessageCircle} size={24} tone="accent" />}
            chevron={false}
            onPress={() => setSheet('whatsapp')}
            testID="famille-whatsapp"
          />
        ) : null}
        {role === 'passenger' ? (
          <ListRow title="Inviter un proche à suivre" leading={<Icon icon={UserPlus} size={24} tone="accent" />} chevron={false} onPress={() => setSheet('invite')} testID="famille-invite" />
        ) : null}
      </ListGroup>
      {calls ? (
        <Sheet
          visible={sheet === 'whatsapp'}
          onClose={() => setSheet(null)}
          dismissible={!busy}
          title={role === 'driver' ? 'Demander un appel au parent' : `Appeler ${driverFirst} sur WhatsApp ?`}
          subtitle={
            role === 'driver'
              ? 'Le parent reçoit votre demande, confirme, puis vous appelle. Vous ne voyez pas son numéro.'
              : 'WhatsApp s’ouvre sur la conversation avec la chauffeuse ; touchez l’icône d’appel. Votre numéro lui sera visible.'
          }
          testID="famille-whatsapp-sheet"
        >
          <View style={{ gap: 12 }}>
            {role === 'driver' ? <StatusBanner compact tone="info" title="Sécurité" message="à l’arrêt uniquement, jamais en conduisant" /> : null}
            <Button label={role === 'driver' ? 'Envoyer la demande' : 'Confirmer et appeler'} size="major" full loading={whatsapp.isPending} onPress={() => whatsapp.run({ tripId: trip.id })} testID="famille-whatsapp-confirm" />
          </View>
        </Sheet>
      ) : null}
      {role === 'passenger' ? <InviteSheet visible={sheet === 'invite'} onClose={() => setSheet(null)} accountId={accountId} /> : null}
    </>
  );
}

export const followLink = (token: string) => (Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/suivi/${token}` : ExpoLinking.createURL(`/suivi/${token}`));

/** Invite the other parent (or a relative) to follow the trips through a private link. */
export function InviteSheet({ visible, onClose, accountId }: { visible: boolean; onClose: () => void; accountId: string }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const share = async (url: string) => {
    const message = `Suivez les trajets Naya Famille en direct : ${url}`;
    try {
      await Share.share({ message });
    } catch {
      toast('Partage indisponible · copiez le lien affiché');
    }
  };
  // One Idempotency-Key per invitation: a double tap or a retry never creates a second link.
  const invite = useSingleFlight((input: { name: string; relationship: string; phone: string | null }, key) => api.prototype.inviteGuardian(input, key), {
    onSuccess: async (r) => {
      const url = followLink(r.token);
      setLink(url);
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      await share(url);
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const busy = invite.isPending;
  return (
    <Sheet visible={visible} onClose={() => { setLink(null); onClose(); }} dismissible={!busy} title="Inviter l’autre parent" subtitle="Cette personne suit les trajets en direct (position, étapes) sans voir les photos, les codes ni votre numéro." testID="famille-invite-sheet">
      <View style={{ gap: 12 }}>
        {link ? (
          <>
            <StatusBanner tone="success" title="Lien de suivi créé" message="Envoyez-le uniquement à la personne concernée. Vous pouvez le retirer à tout moment." />
            <Text variant="caption" selectable numeric testID="famille-invite-link">
              {link}
            </Text>
            <Button label="Partager le lien" full onPress={() => share(link)} />
          </>
        ) : (
          <>
            <FormField label="Prénom" value={name} onChangeText={setName} autoCapitalize="words" testID="famille-invite-name" />
            <FormField label="Lien avec l’enfant" value={relationship} onChangeText={setRelationship} example="Ex. : père, grand-mère, tante" testID="famille-invite-relationship" />
            <FormField label="Téléphone (facultatif)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" example="Ex. : +212 6 12 34 56 78" />
            <Button label="Créer et partager le lien" size="major" full loading={busy} disabled={name.trim().length < 2 || relationship.trim().length < 2} onPress={() => invite.run({ name: name.trim(), relationship: relationship.trim(), phone: phone.trim() ? phone.trim() : null })} testID="famille-invite-confirm" />
          </>
        )}
      </View>
    </Sheet>
  );
}

/**
 * The relatives who follow the trips: one row each with its state glyph (C13), then the invite
 * as the group's last row (P-42). With `onInvite` the group shows even before the first invite.
 */
export function GuardianList({ guardians, accountId, onInvite }: { guardians: NonNullable<import('@naya/domain').FamilyOverview['guardians']>; accountId: string; onInvite?: () => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  // One request at a time per list. This route takes no Idempotency-Key in the API client yet.
  const act = useSingleFlight(({ id, action }: { id: string; action: 'revoke' | 'renew' }) => api.prototype.guardianAction(id, action), {
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      if (r.token) await Share.share({ message: `Nouveau lien de suivi Naya Famille : ${followLink(r.token)}` }).catch(() => undefined);
      else toast('Accès au suivi retiré', 'success');
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const busyOn = act.isPending ? act.variables : undefined;
  const visible = guardians.filter((g) => g.status !== 'revoked');
  if (!visible.length && !onInvite) return null;
  return (
    <ListGroup label="Proches qui suivent les trajets">
      {visible.map((g) => (
        <View key={g.id} testID={`famille-guardian-${g.id}`}>
          <ListRow
            title={`${g.name} · ${g.relationship}`}
            subtitle={g.status === 'active' ? (g.lastViewedAt ? `Vu à ${formatTime(g.lastViewedAt)}` : undefined) : 'Lien pas encore ouvert'}
            status={{ kind: 'guardian', state: g.status }}
          />
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
            <Button label="Nouveau lien" size="compact" variant="secondary" loading={busyOn?.id === g.id && busyOn.action === 'renew'} disabled={act.isPending} onPress={() => act.run({ id: g.id, action: 'renew' })} testID={`famille-guardian-renew-${g.id}`} />
            <Button label="Retirer l’accès" size="compact" variant="ghost" loading={busyOn?.id === g.id && busyOn.action === 'revoke'} disabled={act.isPending} onPress={() => act.run({ id: g.id, action: 'revoke' })} testID={`famille-guardian-revoke-${g.id}`} />
          </View>
        </View>
      ))}
      {onInvite ? <ListRow title="Inviter un proche à suivre" leading={<Icon icon={Plus} size={24} tone="accent" />} chevron={false} onPress={onInvite} testID="famille-invite-open" /> : null}
    </ListGroup>
  );
}

/* ───────────── Status line ───────────── */

/** The trip's state glyph (C11) and its route. The word shows only for a problem (R1); the card reads the state. */
export function TripStatusLine({ trip, viewer }: { trip: Pick<FamilyTrip, 'status' | 'pickup' | 'destination'>; viewer?: 'passenger' | 'driver' }) {
  useTheme();
  return (
    <View style={styles.row}>
      <StatusIcon kind="familyTrip" state={trip.status} viewer={viewer} size="sm" accessible={false} />
      <Text variant="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
        {trip.pickup.label} → {trip.destination.label}
      </Text>
    </View>
  );
}

/** A 40-pt initial avatar for a child (A35): no decorative glyph. */
export function ChildInitial({ name }: { name: string }) {
  useTheme();
  return (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text variant="label" weight="semibold" tone="accent">
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
