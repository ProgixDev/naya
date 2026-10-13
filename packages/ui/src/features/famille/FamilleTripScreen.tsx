import { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import {
  FAMILY_DEMO_PROOFS,
  FAMILY_DROPOFF_RADIUS_METERS,
  FAMILY_MAX_START_REQUESTS,
  FAMILY_STATUS_LABELS,
  HANDOVER_MAX_ATTEMPTS,
  formatDateTime,
  isFamilyTripActive,
  isFamilyTripClosed,
  type FamilyChildView,
  type FamilyLive,
  type FamilyTrip,
} from '@naya/domain';
import { colors } from '@naya/tokens';
import { useTheme } from '../../core/theme';
import { DEMO_MODE } from '../../core/apiBase';
import { Screen, Section } from '../../Screen';
import { Header } from '../../Header';
import { Text } from '../../Text';
import { Button } from '../../Button';
import { ErrorState, SkeletonList, StatusBanner, StatusPill } from '../../Feedback';
import { FormField, Pill } from '../../Form';
import { Sheet } from '../../BottomSheet';
import { toast } from '../../Toast';
import { haptic } from '../../haptics';
import { pickFile, uploadFile } from '../uploads';
import { SafetyButton } from '../prototype';
import { useFamily, useFamilyLive, useFamilyTrip } from './hooks';
import { ApprovalCard, FamilleContactBar, FamilleLiveMap, FamilleTimeline, LiveFacts, ProofPhoto, styles } from './parts';

const statusTone = (t: FamilyTrip) =>
  t.status === 'completed' ? 'success' : t.status === 'cancelled' ? 'danger' : t.status === 'awaiting_approval' ? 'warning' : isFamilyTripActive(t.status) ? 'info' : 'neutral';

/**
 * One Famille trip, for the parent and for the chauffeuse: live map (every second), the
 * start gate, the proofs, calls and the full timestamped timeline (kept after the trip).
 */
export function FamilleTripScreen({ id, accountId, role, onBack }: { id: string; accountId: string; role: 'passenger' | 'driver'; onBack: () => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const trip = useFamilyTrip(accountId, id);
  const family = useFamily(accountId);
  const live = useFamilyLive(accountId, trip.data);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const t = trip.data;
  const child = family.data?.children.find((c) => c.id === t?.childId);
  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: qk.familyTrip(accountId, id) }), qc.invalidateQueries({ queryKey: qk.family(accountId) }), qc.invalidateQueries({ queryKey: qk.familyLive(accountId, id) })]);
  };
  if (trip.isError) return <Screen header={<Header title="Trajet Famille" onBack={onBack} />}><ErrorState onRetry={() => trip.refetch()} /></Screen>;
  if (!t) return <Screen header={<Header title="Trajet Famille" onBack={onBack} />}><SkeletonList rows={4} /></Screen>;
  const last = t.approval ?? null;
  const blocked = t.status === 'picked_up' && last && (last.status === 'refused' || last.status === 'expired');
  const cancellable = ['scheduled', 'en_route', 'arrived', 'picked_up'].includes(t.status);
  const cancel = async () => {
    setBusy(true);
    try {
      await api.prototype.cancelFamilyTrip(t.id, reason.trim());
      setCancelOpen(false);
      toast('Trajet annulé');
      await refresh();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen keyboard header={<Header title={`${t.childName} · ${role === 'driver' ? 'trajet Famille' : t.driverName.split(' ')[0]}`} subtitle={formatDateTime(t.pickupAt)} onBack={onBack} />} testID={`famille-trip-${t.status}`}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone={statusTone(t)} label={FAMILY_STATUS_LABELS[t.status]} testID="famille-status" />
          {t.demo?.driver || t.demo?.parent ? <StatusPill tone="warning" label={t.demo.driver ? 'Chauffeuse simulée' : 'Parent simulé'} /> : null}
        </View>
        <Text variant="title" accessibilityLiveRegion="polite" testID="famille-trip-title">
          {t.childName} · {FAMILY_STATUS_LABELS[t.status]}
        </Text>
        <Text tone="muted">
          {t.pickup.label} → {t.destination.label}
        </Text>
        <FamilleLiveMap trip={t} live={live.data} testID="famille-live-map" />
        <LiveFacts live={live.data} />

        {role === 'passenger' ? <ApprovalCard trip={t} accountId={accountId} onDone={refresh} /> : <DriverWaiting trip={t} />}
        {blocked ? (
          <StatusBanner
            tone={last!.status === 'refused' ? 'danger' : 'warning'}
            title={last!.status === 'refused' ? 'Départ refusé par le parent' : 'Pas de réponse du parent'}
            message={
              role === 'driver'
                ? `Ne partez pas : restez avec ${t.childName} au point de prise en charge, appelez le parent, puis redemandez ou annulez.${last!.reason ? ` Motif : ${last!.reason}.` : ''}`
                : `${t.driverName.split(' ')[0]} reste avec ${t.childName} au point de prise en charge. Elle peut vous redemander l’accord.`
            }
            testID="famille-blocked"
          />
        ) : null}

        {t.status === 'in_progress' && t.handoverLocked ? (
          <StatusBanner
            tone="danger"
            title="Remise bloquée"
            message={
              role === 'driver'
                ? `${HANDOVER_MAX_ATTEMPTS} codes incorrects. Ne confiez pas l’enfant : contactez la famille ou le support Naya.`
                : `${HANDOVER_MAX_ATTEMPTS} codes incorrects ont été saisis : la chauffeuse ne confiera pas l’enfant. Appelez-la ou contactez le support Naya.`
            }
            testID="famille-handover-locked"
          />
        ) : null}

        {role === 'driver' && !isFamilyTripClosed(t.status) ? <DriverStepPanel trip={t} child={child} live={live.data} onChanged={refresh} /> : null}
        {role === 'passenger' && DEMO_MODE && t.status !== 'awaiting_approval' && !isFamilyTripClosed(t.status) && !t.demo?.driver ? <ParentPlaysDriver trip={t} child={child} onChanged={refresh} /> : null}

        {!isFamilyTripClosed(t.status) ? <FamilleContactBar trip={t} role={role} accountId={accountId} /> : null}
        {isFamilyTripActive(t.status) ? <SafetyButton familyTripId={t.id} location={live.data?.location ?? t.location} /> : null}

        {t.pickupPhoto || t.dropoffPhoto ? (
          <Section title="Photos">
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              <ProofPhoto proof={t.pickupPhoto} accountId={accountId} label="Prise en charge" />
              <ProofPhoto proof={t.dropoffPhoto} accountId={accountId} label="Dépôt à l’école" />
            </View>
          </Section>
        ) : null}

        {t.status === 'cancelled' && t.cancellation ? <StatusBanner tone="danger" title="Trajet annulé" message={t.cancellation.reason} /> : null}
        {t.status === 'completed' ? <StatusBanner tone="success" title="Trajet terminé" message="Photo à l’école et remise confirmées. Le journal reste dans l’historique." /> : null}

        <Section title="Journal du trajet">
          <FamilleTimeline trip={t} testID="famille-timeline" />
        </Section>

        {cancellable ? <Button label="Annuler ce trajet" variant="ghost" full onPress={() => setCancelOpen(true)} testID="famille-cancel" /> : null}
      </View>
      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} dismissible={!busy} title="Annuler ce trajet ?" subtitle={role === 'driver' ? 'Le parent est prévenu. Si l’enfant est avec vous, remettez-le à sa famille avant de partir.' : 'La chauffeuse est prévenue immédiatement.'}>
        <View style={{ gap: 12 }}>
          <FormField label="Motif" value={reason} onChangeText={setReason} placeholder={role === 'driver' ? 'Enfant remis à sa mère sur place' : 'Lina est malade aujourd’hui'} />
          <Button label="Confirmer l’annulation" variant="danger" full loading={busy} disabled={!reason.trim()} onPress={cancel} testID="famille-cancel-confirm" />
        </View>
      </Sheet>
    </Screen>
  );
}

function DriverWaiting({ trip }: { trip: FamilyTrip }) {
  useTheme();
  const pending = trip.approval?.status === 'pending' ? trip.approval : null;
  const { seconds } = useDeadline(pending?.expiresAt ?? null, 500);
  if (!pending) return null;
  return (
    <StatusBanner
      tone="info"
      title="En attente de l’accord du parent"
      message={`Ne démarrez pas avant l’accord · ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s restantes`}
      testID="famille-waiting-approval"
    />
  );
}

/** The chauffeuse's steps: depart, arrive, photograph the child, ask to start, drop-off proof. */
function DriverStepPanel({ trip: t, child, live, onChanged }: { trip: FamilyTrip; child?: FamilyChildView; live?: FamilyLive; onChanged: () => Promise<void> }) {
  useTheme();
  const api = useApi();
  const [busy, setBusy] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [recipient, setRecipient] = useState(child?.recipients[0]?.id ?? '');
  const [code, setCode] = useState('');
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      haptic.success();
      await onChanged();
    } catch (e) {
      toast(errorMessage(e), 'danger');
      // A refused handover code is still counted: show the attempts left, or the lock, at once.
      void onChanged();
    } finally {
      setBusy(null);
    }
  };
  const advance = (extra: { proof?: string; childName?: string; recipientId?: string; code?: string } = {}) => api.prototype.advance(t.id, { expectedStatus: t.status, ...extra });
  const takePhoto = () =>
    run('photo', async () => {
      const f = await pickFile('camera');
      if (f === 'denied') throw new Error('Autorisez l’appareil photo dans les réglages pour photographier l’enfant.');
      if (!f) return;
      const u = await uploadFile(api, f, 'family_proof');
      setPhoto(u.id);
    });
  const photoButtons = (kind: 'pickup' | 'dropoff') => (
    <View style={{ gap: 8 }}>
      {photo ? (
        <StatusBanner compact tone="success" title="Photo prête" message={photo.startsWith('demo-') ? 'photo simulée (démo)' : 'elle sera jointe au trajet'} />
      ) : (
        <>
          <Button label={kind === 'pickup' ? `Photographier ${t.childName}` : `Photographier ${t.childName} dans l’école`} variant="secondary" full icon={<Camera size={17} color={colors.accent} />} loading={busy === 'photo'} onPress={takePhoto} testID={`famille-${kind}-camera`} />
          {DEMO_MODE ? <Button label="Photo simulée (démo)" variant="ghost" full onPress={() => setPhoto(FAMILY_DEMO_PROOFS[kind])} testID={`famille-${kind}-demo-photo`} /> : null}
        </>
      )}
    </View>
  );
  const requests = (t.approvals ?? []).length;
  const far = live && live.leg === 'to_school' && live.remainingMeters > FAMILY_DROPOFF_RADIUS_METERS;
  return (
    <View style={styles.panel} testID="famille-driver-steps">
      {t.status === 'scheduled' ? <Button label={`Partir chercher ${t.childName}`} size="major" full loading={busy === 'go'} onPress={() => run('go', () => advance())} testID="famille-depart" /> : null}
      {t.status === 'en_route' ? <Button label="Je suis arrivée" size="major" full loading={busy === 'arrive'} onPress={() => run('arrive', () => advance())} testID="famille-arrive" /> : null}
      {t.status === 'arrived' ? (
        <>
          <Text variant="heading">Prise en charge</Text>
          <Text variant="caption" tone="muted">
            Photographiez {t.childName} avant de démarrer, puis confirmez son prénom (attestation).
          </Text>
          {photoButtons('pickup')}
          <FormField label="Prénom confirmé par la chauffeuse" value={name} onChangeText={setName} autoCapitalize="words" testID="famille-child-name" />
          <Button label="Confirmer la prise en charge" size="major" full disabled={!photo || !name.trim()} disabledReason={!photo ? 'Photo de l’enfant requise' : undefined} loading={busy === 'pickup'} onPress={() => run('pickup', async () => { await advance({ proof: photo!, childName: name }); setPhoto(null); })} testID="famille-pickup" />
        </>
      ) : null}
      {t.status === 'picked_up' ? (
        <>
          <Text variant="caption" tone="muted">
            « Démarrer » envoie une demande au parent. Le trajet ne démarre qu’après son accord.
          </Text>
          <Button
            label="Démarrer"
            size="major"
            full
            disabled={requests >= FAMILY_MAX_START_REQUESTS}
            disabledReason={requests >= FAMILY_MAX_START_REQUESTS ? 'Trop de demandes : appelez le parent ou annulez' : undefined}
            loading={busy === 'start'}
            onPress={() => run('start', () => advance())}
            testID="famille-request-start"
          />
        </>
      ) : null}
      {t.status === 'in_progress' && !t.handoverLocked ? (
        <>
          <Text variant="heading">Dépôt à l’école</Text>
          <Text variant="caption" tone="muted">
            Photo obligatoire dans l’enceinte de l’école{child?.recipients.length ? ', puis code de la personne autorisée' : ''}.
          </Text>
          {far ? <StatusBanner compact tone="info" title="Pas encore à l’école" message={`photo possible à moins de ${FAMILY_DROPOFF_RADIUS_METERS} m`} /> : null}
          {photoButtons('dropoff')}
          {child?.recipients.length ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {child.recipients.map((r) => (
                  <Pill key={r.id} label={`${r.name} · ${r.relationship}`} selected={recipient === r.id} onPress={() => setRecipient(r.id)} />
                ))}
              </View>
              <FormField label="Code de remise" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={4} testID="famille-code" />
              {t.handoverAttempts ? (
                <Text variant="caption" tone="danger" testID="famille-code-attempts">
                  {HANDOVER_MAX_ATTEMPTS - t.handoverAttempts > 1
                    ? `Code incorrect · ${HANDOVER_MAX_ATTEMPTS - t.handoverAttempts} essais restants avant le blocage de la remise`
                    : 'Code incorrect · dernier essai avant le blocage de la remise'}
                </Text>
              ) : null}
            </>
          ) : null}
          <Button
            label="Clôturer le trajet"
            size="major"
            full
            disabled={!photo || (!!child?.recipients.length && code.length !== 4)}
            disabledReason={!photo ? 'Photo à l’école requise' : undefined}
            loading={busy === 'drop'}
            onPress={() => run('drop', async () => { await advance({ proof: photo!, recipientId: recipient, code }); setPhoto(null); toast('Trajet clôturé', 'success'); })}
            testID="famille-dropoff"
          />
        </>
      ) : null}
      <Text variant="micro" tone="muted">
        Votre position est partagée chaque seconde avec le parent pendant le trajet.
      </Text>
    </View>
  );
}

/** Dev mode only: lets a single tester play the chauffeuse from the parent's phone. */
function ParentPlaysDriver({ trip: t, child, onChanged }: { trip: FamilyTrip; child?: FamilyChildView; onChanged: () => Promise<void> }) {
  useTheme();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const step = async () => {
    setBusy(true);
    try {
      const r = child?.recipients[0];
      const extra =
        t.status === 'arrived'
          ? { proof: FAMILY_DEMO_PROOFS.pickup, childName: t.childName }
          : t.status === 'in_progress'
            ? { proof: FAMILY_DEMO_PROOFS.dropoff, recipientId: r?.id, code: r?.verificationCode }
            : {};
      await api.prototype.advance(t.id, { expectedStatus: t.status, ...extra });
      await onChanged();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return <Button label="Démo · jouer l’étape suivante de la chauffeuse" variant="ghost" size="compact" full loading={busy} onPress={step} testID="famille-parent-plays" />;
}
