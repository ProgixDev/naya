import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Car, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, FileText, UserRound, XCircle } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { ITEM_LABELS, REQUIRED_ITEMS, STATUS_LABELS, type VerificationCase, type VerificationItemKey } from '@naya/domain';
import { colors, shadow } from '@naya/tokens';
import { Button, IconDisc, PressableScale, StatusPill, StepProgress, Text, toast, haptic, type BannerTone } from '@naya/ui';
import { ActionNote } from './Kit';
import { useAccountId } from '@/lib/queries';

export const statusTone = (s: VerificationCase['status']): BannerTone =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'more_info_requested' ? 'warning' : s === 'draft' ? 'neutral' : 'info';

const itemIcon = (status: string) =>
  status === 'accepted' ? <CheckCircle2 size={18} color={colors.success} /> : status === 'provided' ? <CheckCircle2 size={18} color={colors.accent} /> : status === 'needs_correction' ? <AlertTriangle size={18} color={colors.warning} /> : <Circle size={18} color={colors.line} />;

const itemStatusLabel = (status: string) => (status === 'accepted' ? 'Validée' : status === 'provided' ? 'Ajoutée' : status === 'needs_correction' ? 'À reprendre' : 'À ajouter');

const itemDone = (status: string) => status === 'accepted' || status === 'provided';

export function isComplete(c: VerificationCase) {
  const detailsOk = c.subject === 'vehicle' ? !!c.vehicle : !!c.identity;
  return detailsOk && REQUIRED_ITEMS[c.subject].every((k) => {
    const i = c.items.find((x) => x.key === k);
    return i && i.uploadIds.length > 0 && (i.status === 'provided' || i.status === 'accepted');
  });
}

const editable = (c: VerificationCase) => c.status === 'draft' || c.status === 'more_info_requested';

/** Done / total steps of one dossier (details + each required item). */
export function caseProgress(kase: VerificationCase | null, subject: 'driver_identity' | 'vehicle') {
  const items = REQUIRED_ITEMS[subject];
  const details = subject === 'vehicle' ? !!kase?.vehicle : !!kase?.identity;
  const done = (details ? 1 : 0) + items.filter((k) => itemDone(kase?.items.find((i) => i.key === k)?.status ?? 'missing')).length;
  return { done, total: items.length + 1 };
}

/** Compact Persona-style step row: 48 pt, state icon, label, state word, chevron when editable. */
function StepRow({ title, note, status, onPress, testID }: { title: string; note?: string | null; status: string; onPress?: () => void; testID?: string }) {
  const tone = status === 'needs_correction' ? 'warning' : itemDone(status) ? 'muted' : 'accent';
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 6 }}>
      {itemIcon(status)}
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        {note ? (
          <Text variant="micro" tone={status === 'needs_correction' ? 'warning' : 'muted'} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
      <Text variant="micro" weight="semibold" tone={tone}>
        {itemStatusLabel(status)}
      </Text>
      {onPress ? <ChevronRight size={16} color={colors.muted} /> : null}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} pressedScale={0.985} accessibilityRole="button" accessibilityLabel={`${title}, ${itemStatusLabel(status)}${note ? `, ${note}` : ''}`} testID={testID}>
      {body}
    </PressableScale>
  ) : (
    <View testID={testID} accessible accessibilityLabel={`${title}, ${itemStatusLabel(status)}`}>
      {body}
    </View>
  );
}

/**
 * One dossier as a card: header with progress, then its steps. Collapsed cards show only the
 * header (tap to open), so the hub fits one screen; the card that needs work opens by default.
 */
export function CaseChecklist({ kase, subject, collapsed, onToggle, primary = true }: { kase: VerificationCase | null; subject: 'driver_identity' | 'vehicle'; collapsed?: boolean; onToggle?: () => void; primary?: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const submit = useMutation({
    mutationFn: (id: string) => api.verification.submit(id),
    onSuccess: () => {
      haptic.success();
      toast('Dossier envoyé pour examen');
      qc.invalidateQueries({ queryKey: qk.me(a) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const isVehicle = subject === 'vehicle';
  const canEdit = !kase || editable(kase);
  const details = isVehicle ? kase?.vehicle : kase?.identity;
  const items: VerificationItemKey[] = REQUIRED_ITEMS[subject];
  const title = isVehicle ? 'Véhicule' : 'Identité et permis';
  const { done, total } = caseProgress(kase, subject);
  const status = kase?.status ?? 'draft';
  const Icon = isVehicle ? Car : UserRound;
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconDisc size={40} tone={status === 'approved' ? 'success' : 'plain'}>
        <Icon size={19} color={status === 'approved' ? colors.success : colors.accent} />
      </IconDisc>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="label" weight="semibold" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
          <Text variant="micro" tone="muted" numeric>
            {done}/{total}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusPill tone={statusTone(status)} label={STATUS_LABELS[status]} />
          <StepProgress step={done} total={total} />
        </View>
      </View>
      {onToggle ? <ChevronDown size={18} color={colors.muted} style={{ transform: [{ rotate: collapsed ? '0deg' : '180deg' }] }} /> : null}
    </View>
  );
  return (
    <View style={styles.card} testID={`checklist-${subject}`}>
      {onToggle ? (
        <PressableScale onPress={onToggle} pressedScale={0.99} accessibilityRole="button" accessibilityState={{ expanded: !collapsed }} accessibilityLabel={`${title}, ${STATUS_LABELS[status]}, ${done} sur ${total} étapes`} testID={`toggle-${subject}`}>
          {header}
        </PressableScale>
      ) : (
        header
      )}
      {collapsed ? null : (
        <View style={{ marginTop: 6 }}>
          <StepRow
            title={isVehicle ? 'Informations du véhicule' : 'Informations personnelles'}
            note={details ? (isVehicle ? `${kase!.vehicle!.make} ${kase!.vehicle!.model} · ${kase!.vehicle!.plate}` : `${kase!.identity!.firstName} ${kase!.identity!.lastName}`) : null}
            status={details ? 'provided' : 'missing'}
            onPress={canEdit ? () => router.push(isVehicle ? '/docs/vehicle' : '/docs/identity') : undefined}
            testID={`step-${subject}-details`}
          />
          {items.map((key) => {
            const item = kase?.items.find((i) => i.key === key);
            const st = item?.status ?? 'missing';
            const open = canEdit && (isVehicle ? !!kase : true);
            return <StepRow key={key} title={ITEM_LABELS[key]} note={st === 'needs_correction' ? item?.note : null} status={st} onPress={open ? () => router.push({ pathname: '/docs/capture/[item]', params: { item: key } }) : undefined} testID={`step-${key}`} />;
          })}
          {isVehicle && !kase ? (
            <Text variant="micro" tone="muted" style={{ marginTop: 4 }}>
              Commencez par les informations du véhicule pour ajouter ses documents.
            </Text>
          ) : null}
          {kase && canEdit ? (
            <Button
              label={kase.status === 'more_info_requested' ? 'Renvoyer le complément' : `Envoyer le dossier ${isVehicle ? 'véhicule' : 'identité'}`}
              variant={primary ? 'primary' : 'secondary'}
              full
              style={{ marginTop: 8 }}
              disabled={!isComplete(kase)}
              disabledReason={!isComplete(kase) ? `${total - done} étape${total - done > 1 ? 's' : ''} à compléter avant l’envoi.` : undefined}
              loading={submit.isPending}
              onPress={() => submit.mutate(kase.id)}
              testID={`submit-${subject}`}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 14, ...shadow.card },
});

/** D05: one dossier's review state, with the next step the driver can take. */
export function CaseReview({ kase, subject, recoverable }: { kase: VerificationCase | null; subject: 'driver_identity' | 'vehicle'; recoverable: string[] }) {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const reopen = useMutation({
    mutationFn: (id: string) => api.verification.reopen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me(a) }),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const label = subject === 'vehicle' ? 'Véhicule' : 'Chauffeuse';
  if (!kase || kase.status === 'draft') {
    return <ActionNote tone="neutral" title={`${label} · dossier à compléter`} message="Ajoutez les pièces puis envoyez." icon={<FileText size={18} color={colors.accent} />} action={{ label: 'Compléter', onPress: () => router.push('/docs/start') }} testID={`review-${subject}`} />;
  }
  switch (kase.status) {
    case 'approved':
      return <ActionNote tone="success" title={subject === 'vehicle' ? 'Véhicule approuvé' : 'Chauffeuse approuvée'} message={subject === 'vehicle' ? 'Documents vérifiés par l’équipe Naya.' : 'Identité et permis vérifiés par l’équipe Naya.'} testID={`review-${subject}`} />;
    case 'submitted':
    case 'in_review':
      return <ActionNote tone="info" title={`${label} en attente d’examen`} message="Une personne de l’équipe Naya examine vos documents." icon={<Clock size={18} color={colors.info} />} testID={`review-${subject}`} />;
    case 'more_info_requested':
      return (
        <View style={{ gap: 12 }} testID={`review-${subject}`}>
          <ActionNote tone="warning" title={`${label} · complément demandé`} message={kase.decision?.message ?? 'Une pièce doit être reprise.'} icon={<AlertTriangle size={18} color={colors.warning} />} />
          <CaseChecklist kase={kase} subject={subject} />
        </View>
      );
    case 'rejected': {
      const canRestart = recoverable.includes(kase.decision?.reasonCode ?? '');
      return (
        <ActionNote
          testID={`review-${subject}`}
          tone="danger"
          icon={<XCircle size={18} color={colors.danger} />}
          title={`${label} · dossier refusé`}
          message={kase.decision?.message ?? 'Le dossier n’a pas été approuvé.'}
          action={canRestart ? { label: reopen.isPending ? 'Ouverture…' : 'Recommencer', onPress: () => reopen.mutate(kase.id) } : { label: 'Assistance', onPress: () => router.push('/support/new') }}
        />
      );
    }
    default:
      return null;
  }
}
