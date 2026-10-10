import { themedStyles , colors, shadow } from '@naya/tokens';
import { useTheme } from '@naya/ui';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, Camera, Car, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, FileText, IdCard, ScanFace, ShieldCheck, UserRound, XCircle } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { ITEM_LABELS, REQUIRED_ITEMS, STATUS_LABELS, type VerificationCase, type VerificationItemKey } from '@naya/domain';
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
const ITEM_ICON: Record<string, typeof Car> = { selfie: ScanFace, id_front: IdCard, id_back: IdCard, driving_licence: BadgeCheck, registration: FileText, insurance: ShieldCheck, vehicle_photos: Camera, vehicle_registration: FileText, carte_grise: FileText, details_person: UserRound, details_vehicle: Car };
const chipTone = (status: string) =>
  status === 'accepted' ? { bg: colors.successSoft, fg: colors.success } : status === 'provided' ? { bg: colors.selected, fg: colors.accent } : status === 'needs_correction' ? { bg: colors.warningSoft, fg: colors.warning } : { bg: colors.background, fg: colors.muted };

function StepRow({ title, note, status, onPress, testID, iconKey }: { title: string; note?: string | null; status: string; onPress?: () => void; testID?: string; iconKey?: string }) {
  useTheme();
  const Icon = (iconKey && ITEM_ICON[iconKey]) || FileText;
  const t = chipTone(status);
  const done = itemDone(status);
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: status === 'accepted' ? colors.successSoft : status === 'needs_correction' ? colors.warningSoft : colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>
        {status === 'accepted' ? <CheckCircle2 size={19} color={colors.success} strokeWidth={2} /> : <Icon size={19} color={status === 'needs_correction' ? colors.warning : colors.accent} strokeWidth={1.9} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text weight={done ? 'medium' : 'semibold'} numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{title}</Text>
        {note ? <Text tone={status === 'needs_correction' ? 'warning' : 'muted'} numberOfLines={2} style={{ fontSize: 13, lineHeight: 18 }}>{note}</Text> : null}
      </View>
      <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: t.bg, justifyContent: 'center' }}>
        <Text weight="semibold" style={{ fontSize: 12, lineHeight: 16, color: t.fg }}>{itemStatusLabel(status)}</Text>
      </View>
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
  useTheme();
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
  const pct = total ? done / total : 0;
  const header = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: status === 'approved' ? colors.successSoft : colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={status === 'approved' ? colors.success : colors.accent} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text weight="semibold" accessibilityRole="header" numberOfLines={1} style={{ fontSize: 17, lineHeight: 23 }}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusPill tone={statusTone(status)} label={STATUS_LABELS[status]} />
            <Text tone="muted" numeric style={{ fontSize: 12, lineHeight: 16 }}>{done}/{total} étapes</Text>
          </View>
        </View>
        {onToggle ? <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><View style={{ transform: [{ rotate: collapsed ? '0deg' : '180deg' }] }}><ChevronDown size={18} color={colors.muted} /></View></View> : null}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.background, overflow: 'hidden' }} accessibilityElementsHidden>
        <View style={{ height: 6, width: `${Math.round(pct * 100)}%`, borderRadius: 3, backgroundColor: status === 'approved' ? colors.success : colors.accent }} />
      </View>
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
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 4 }}>
          <StepRow
            iconKey={isVehicle ? 'details_vehicle' : 'details_person'}
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
            return <StepRow key={key} iconKey={key} title={ITEM_LABELS[key]} note={st === 'needs_correction' ? item?.note : null} status={st} onPress={open ? () => router.push({ pathname: '/docs/capture/[item]', params: { item: key } }) : undefined} testID={`step-${key}`} />;
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

const styles = themedStyles(() => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 16, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
}));

/** D05: one dossier's review state, with the next step the driver can take. */
export function CaseReview({ kase, subject, recoverable }: { kase: VerificationCase | null; subject: 'driver_identity' | 'vehicle'; recoverable: string[] }) {
  useTheme();
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
