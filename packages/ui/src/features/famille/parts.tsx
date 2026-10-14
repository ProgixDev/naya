import { useMemo, useState } from 'react';
import { Image, Linking, Platform, Share, View } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { CheckCircle2, Clock, MapPin, MessageCircle, School, ShieldAlert, ShieldCheck, Signal, UserPlus, XCircle } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, newIdempotencyKey, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import {
  formatDistance,
  formatTime,
  FAMILY_APPROVAL_TIMEOUT_SECONDS,
  FAMILY_DEMO_PROOFS,
  MOROCCO_POLICE_NUMBER,
  type FamilyLive,
  type FamilyProof,
  type FamilyTimelineEntry,
  type FamilyTrip,
} from '@naya/domain';
import { mockPhotos } from '@naya/assets';
import { colors, radius, themedStyles } from '@naya/tokens';
import { useTheme } from '../../core/theme';
import { DEMO_MODE } from '../../core/apiBase';
import { useA11yPrefs } from '../../a11y';
import { Text } from '../../Text';
import { Button } from '../../Button';
import { StatusBanner } from '../../Feedback';
import { FormField } from '../../Form';
import { IconDisc, ListGroup, ListRow } from '../../List';
import { Sheet } from '../../BottomSheet';
import { toast } from '../../Toast';
import { NayaMap } from '../../map';
import { useAnimatedCoordinate } from '../../map/useAnimatedCoordinate';
import { Attachment } from '../Attachment';

export const styles = themedStyles(() => ({
  panel: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, gap: 12 },
  soft: { backgroundColor: colors.selected, borderRadius: radius.card, padding: 18, gap: 10 },
  mapBox: { borderRadius: 22, overflow: 'hidden' as const, backgroundColor: colors.map },
  chip: { position: 'absolute' as const, left: 10, bottom: 10, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: colors.surface },
  photo: { width: 132, height: 99, borderRadius: 14, backgroundColor: colors.mauveSoft },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
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
        <View style={styles.chip} accessibilityLiveRegion="polite">
          {live.source === 'gps' ? <Signal size={14} color={live.stale ? colors.warning : colors.success} /> : <Clock size={14} color={colors.accent} />}
          <Text variant="micro" weight="semibold" numeric testID="famille-live-age">
            {live.source === 'gps' ? `GPS · il y a ${live.ageSeconds} s` : 'Position · chaque seconde'}
            {live.etaSeconds != null ? ` · ${live.leg === 'to_pickup' ? 'arrivée' : 'école'} dans ${formatEta(live.etaSeconds)}` : ''}
          </Text>
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

const KIND_TONE: Partial<Record<NonNullable<FamilyTimelineEntry['kind']>, 'success' | 'warning' | 'danger' | 'accent'>> = {
  pickup_photo: 'accent',
  start_approved: 'success',
  live_started: 'success',
  dropoff_photo: 'accent',
  completed: 'success',
  start_refused: 'danger',
  start_expired: 'warning',
  cancelled: 'danger',
  police: 'danger',
  incident: 'warning',
};

/** Lines written before 14 Oct 2026 carry a « simulation » / « (démo) » marker: shown without it. */
const timelineLabel = (label: string) =>
  label
    .replace(/ · simulation$/, '')
    .replace(/ \((?:simulée|démo)\)/g, '')
    .replace(' · joué par le parent', ' · saisi depuis le compte parent')
    .replace('un trajet de démonstration', 'un nouveau trajet');

/** Every step of the trip, timestamped (kept in the history once the trip closes). */
export function FamilleTimeline({ trip, testID }: { trip: FamilyTrip; testID?: string }) {
  useTheme();
  const tones = { success: colors.success, warning: colors.warning, danger: colors.danger, accent: colors.accent };
  return (
    <View style={{ gap: 10 }} testID={testID}>
      {trip.timeline.map((e, i) => {
        const tone = e.kind ? KIND_TONE[e.kind] : undefined;
        return (
          <View key={`${e.at}-${i}`} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[styles.dot, { backgroundColor: tone ? tones[tone] : colors.line }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{timelineLabel(e.label)}</Text>
              <Text variant="caption" tone="muted" numeric>
                {formatTime(e.at)} · {e.location.lat.toFixed(4)}, {e.location.lng.toFixed(4)}
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

/**
 * The start gate. The parent sees the pick-up photo and answers on site or remotely;
 * without an answer before the server deadline the request expires and nothing moves.
 */
export function ApprovalCard({ trip, accountId, onDone }: { trip: FamilyTrip; accountId: string; onDone?: () => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const approval = trip.approval;
  const { seconds, expired } = useDeadline(approval?.status === 'pending' ? approval.expiresAt : null, 500);
  const [busy, setBusy] = useState<string | null>(null);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
  if (!approval || approval.status !== 'pending') return null;
  const answer = async (decision: 'approve' | 'refuse', mode: 'on_site' | 'remote') => {
    setBusy(`${decision}-${mode}`);
    try {
      await api.prototype.approveStart(trip.id, { decision, mode, approvalId: approval.id, reason: decision === 'refuse' ? reason.trim() || undefined : undefined }, newIdempotencyKey());
      toast(decision === 'approve' ? 'Départ approuvé' : 'Départ refusé · la chauffeuse est prévenue', decision === 'approve' ? 'success' : undefined);
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      onDone?.();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={[styles.panel, { borderWidth: 2, borderColor: colors.accent }]} testID="famille-approval">
      <View style={styles.row}>
        <IconDisc tone="accent">
          <ShieldCheck size={18} color={colors.accent} />
        </IconDisc>
        <View style={{ flex: 1 }}>
          <Text variant="heading" accessibilityRole="header">
            {trip.driverName.split(' ')[0]} demande à démarrer
          </Text>
          <Text variant="caption" tone={seconds <= 30 ? 'danger' : 'muted'} numeric accessibilityLiveRegion="polite">
            {expired ? 'Demande expirée' : `Répondez dans ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`}
          </Text>
        </View>
      </View>
      <ProofPhoto proof={trip.pickupPhoto} accountId={accountId} label={`Photo de ${trip.childName} à la prise en charge`} />
      <Text variant="caption" tone="muted">
        Vérifiez la photo. Sans votre accord, le trajet ne démarre pas ({FAMILY_APPROVAL_TIMEOUT_SECONDS / 60} min pour répondre).
      </Text>
      <Button label="Je suis sur place · j’approuve" size="major" full loading={busy === 'approve-on_site'} disabled={expired || !!busy} onPress={() => answer('approve', 'on_site')} testID="famille-approve-onsite" />
      <Button label="Approuver à distance" variant="secondary" full loading={busy === 'approve-remote'} disabled={expired || !!busy} onPress={() => answer('approve', 'remote')} testID="famille-approve-remote" />
      {refusing ? (
        <View style={{ gap: 8 }}>
          <FormField label="Motif (facultatif)" value={reason} onChangeText={setReason} placeholder="Je viens la chercher moi-même" />
          <Button label="Confirmer le refus" variant="danger" full loading={busy === 'refuse-remote'} disabled={!!busy} onPress={() => answer('refuse', 'remote')} testID="famille-refuse-confirm" />
        </View>
      ) : (
        <Button label="Refuser le départ" variant="ghost" full disabled={expired || !!busy} onPress={() => setRefusing(true)} testID="famille-refuse" />
      )}
    </View>
  );
}

/* ───────────── Calls and invites ───────────── */

/** WhatsApp, police and co-parent invite. Every hand-off goes through a confirmation sheet. */
export function FamilleContactBar({ trip, role, accountId }: { trip: FamilyTrip; role: 'passenger' | 'driver'; accountId: string }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<'whatsapp' | 'police' | 'invite' | null>(null);
  const [busy, setBusy] = useState(false);
  const driverFirst = trip.driverName.split(' ')[0] ?? trip.driverName;
  const refresh = () => qc.invalidateQueries({ queryKey: qk.family(accountId) });

  const callWhatsApp = async () => {
    setBusy(true);
    try {
      if (role === 'driver') {
        await api.prototype.requestFamilyCall(trip.id);
        toast('Demande envoyée · le parent confirme puis vous appelle');
      } else {
        const r = await api.prototype.familyCall(trip.id, 'whatsapp');
        // Mock accounts carry made-up numbers: the call is noted on the trip, WhatsApp is not opened.
        if (r.simulated || DEMO_MODE) toast(`Appel vers ${r.counterpartName} noté sur le trajet`);
        else {
          const app = r.appUrl && (await Linking.canOpenURL(r.appUrl).catch(() => false));
          await Linking.openURL(app ? r.appUrl! : r.url);
        }
      }
      setSheet(null);
      await refresh();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const callPolice = async () => {
    setBusy(true);
    try {
      // Always a real call: someone may really need it.
      await api.prototype.familyCall(trip.id, 'police').catch(() => undefined);
      setSheet(null);
      await Linking.openURL(`tel:${MOROCCO_POLICE_NUMBER}`);
      await refresh();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label={role === 'driver' ? 'Demander un appel' : 'WhatsApp'}
          variant="secondary"
          size="compact"
          style={{ flex: 1 }}
          full
          icon={<MessageCircle size={16} color={colors.accent} />}
          onPress={() => setSheet('whatsapp')}
          testID="famille-whatsapp"
        />
        <Button label={`Police ${MOROCCO_POLICE_NUMBER}`} variant="danger" size="compact" style={{ flex: 1 }} full icon={<ShieldAlert size={16} color={colors.inverse} />} onPress={() => setSheet('police')} testID="famille-police" />
        {role === 'passenger' ? (
          <Button label="Inviter" variant="secondary" size="compact" style={{ flex: 1 }} full icon={<UserPlus size={16} color={colors.accent} />} onPress={() => setSheet('invite')} testID="famille-invite" />
        ) : null}
      </View>
      <Sheet
        visible={sheet === 'whatsapp'}
        onClose={() => setSheet(null)}
        dismissible={!busy}
        title={role === 'driver' ? 'Demander un appel au parent' : `Appeler ${driverFirst} sur WhatsApp ?`}
        subtitle={
          role === 'driver'
            ? 'Le parent reçoit votre demande, confirme, puis vous appelle. Vous ne voyez pas son numéro.'
            : DEMO_MODE
              ? 'L’appel est noté sur le trajet. La mise en relation WhatsApp n’est pas encore disponible.'
              : 'WhatsApp s’ouvre sur la conversation avec la chauffeuse ; touchez l’icône d’appel. Votre numéro lui sera visible.'
        }
        testID="famille-whatsapp-sheet"
      >
        <View style={{ gap: 12 }}>
          {role === 'driver' ? <StatusBanner compact tone="info" title="Sécurité" message="à l’arrêt uniquement, jamais en conduisant" /> : null}
          <Button label={role === 'driver' ? 'Envoyer la demande' : DEMO_MODE ? 'Confirmer' : 'Confirmer et appeler'} size="major" full loading={busy} onPress={callWhatsApp} testID="famille-whatsapp-confirm" />
        </View>
      </Sheet>
      <Sheet visible={sheet === 'police'} onClose={() => setSheet(null)} dismissible={!busy} title={`Appeler la police (${MOROCCO_POLICE_NUMBER}) ?`} subtitle="L’appel part de votre téléphone. Il est noté sur le trajet et l’autre partie est prévenue." testID="famille-police-sheet">
        <View style={{ gap: 12 }}>
          <StatusBanner compact tone="danger" title="Urgence" message={`police secours · ${MOROCCO_POLICE_NUMBER}`} />
          <Button label={`Appeler le ${MOROCCO_POLICE_NUMBER}`} variant="danger" size="major" full loading={busy} onPress={callPolice} testID="famille-police-confirm" />
        </View>
      </Sheet>
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
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const share = async (url: string) => {
    const message = `Suivez les trajets Naya Famille en direct : ${url}`;
    try {
      await Share.share({ message });
    } catch {
      toast('Partage indisponible · copiez le lien affiché');
    }
  };
  const invite = async () => {
    setBusy(true);
    try {
      const r = await api.prototype.inviteGuardian({ name: name.trim(), relationship: relationship.trim(), phone: phone.trim() ? phone.trim() : null }, newIdempotencyKey());
      const url = followLink(r.token);
      setLink(url);
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      await share(url);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={() => { setLink(null); onClose(); }} dismissible={!busy} title="Inviter l’autre parent" subtitle="Il ou elle suit les trajets en direct (position, étapes) sans voir les photos, les codes ni votre numéro." testID="famille-invite-sheet">
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
            <FormField label="Lien avec l’enfant" value={relationship} onChangeText={setRelationship} placeholder="Père, grand-mère, tante…" testID="famille-invite-relationship" />
            <FormField label="Téléphone (facultatif)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+212…" />
            <Button label="Créer et partager le lien" size="major" full loading={busy} disabled={name.trim().length < 2 || relationship.trim().length < 2} onPress={invite} testID="famille-invite-confirm" />
          </>
        )}
      </View>
    </Sheet>
  );
}

export function GuardianList({ guardians, accountId }: { guardians: NonNullable<import('@naya/domain').FamilyOverview['guardians']>; accountId: string }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const act = async (id: string, action: 'revoke' | 'renew') => {
    try {
      const r = await api.prototype.guardianAction(id, action);
      await qc.invalidateQueries({ queryKey: qk.family(accountId) });
      if (r.token) await Share.share({ message: `Nouveau lien de suivi Naya Famille : ${followLink(r.token)}` }).catch(() => undefined);
      else toast('Accès au suivi retiré');
    } catch (e) {
      toast(errorMessage(e), 'danger');
    }
  };
  const visible = guardians.filter((g) => g.status !== 'revoked');
  if (!visible.length) return null;
  return (
    <ListGroup label="Proches qui suivent les trajets">
      {visible.map((g) => (
        <View key={g.id}>
          <ListRow title={`${g.name} · ${g.relationship}`} subtitle={g.status === 'active' ? `Suivi ouvert${g.lastViewedAt ? ` · vu à ${formatTime(g.lastViewedAt)}` : ''}` : 'Invitation envoyée · lien pas encore ouvert'} leading={<IconDisc><UserPlus size={18} color={colors.accent} /></IconDisc>} />
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
            <Button label="Nouveau lien" size="compact" variant="secondary" onPress={() => act(g.id, 'renew')} />
            <Button label="Retirer l’accès" size="compact" variant="ghost" onPress={() => act(g.id, 'revoke')} />
          </View>
        </View>
      ))}
    </ListGroup>
  );
}

/* ───────────── Status line ───────────── */

export function TripStatusLine({ trip }: { trip: FamilyTrip }) {
  useTheme();
  const icon =
    trip.status === 'completed' ? <CheckCircle2 size={16} color={colors.success} /> : trip.status === 'cancelled' ? <XCircle size={16} color={colors.danger} /> : trip.status === 'in_progress' ? <School size={16} color={colors.accent} /> : trip.status === 'scheduled' ? <Clock size={16} color={colors.muted} /> : trip.status === 'awaiting_approval' ? <ShieldCheck size={16} color={colors.warning} /> : <MapPin size={16} color={colors.accent} />;
  return (
    <View style={styles.row}>
      {icon}
      <Text variant="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
        {trip.pickup.label} → {trip.destination.label}
      </Text>
    </View>
  );
}
