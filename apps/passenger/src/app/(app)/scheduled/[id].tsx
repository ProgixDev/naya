import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CreditCard, Route as RouteIcon } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { casablancaLocalToUtc, formatDateTime, formatMoney, formatShort, SCHEDULED_STATUS_LABELS, toCasablancaParts } from '@naya/domain';
import { colors } from '@naya/tokens';
import { Button, Card, ConfirmDialog, ErrorState, FareBreakdown, Header, IconDisc, ListGroup, ListRow, Screen, Sheet, SkeletonList, StatusBanner, StatusPill, Text, haptic, toast } from '@naya/ui';
import { useAccountId } from '@/lib/queries';
import { SchedulePicker } from '@/features/schedule/SchedulePicker';

/** P12-detail: recorded booking, modify time (price unchanged), cancel (free). */
export default function ScheduledDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const q = useQuery({ queryKey: qk.scheduledOne(a, id), queryFn: () => api.scheduled.get(id), refetchInterval: 15_000 });
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const b = q.data;
  const parts = b ? toCasablancaParts(b.pickupAt) : null;
  const [day, setDay] = useState(parts?.date ?? '');
  const [time, setTime] = useState<string | null>(parts?.time ?? null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.scheduled(a) });
    qc.invalidateQueries({ queryKey: qk.scheduledOne(a, id) });
  };
  const modify = useMutation({
    mutationFn: () => api.scheduled.modify(id, casablancaLocalToUtc(day, time!)),
    onSuccess: () => {
      haptic.success();
      toast('Horaire modifié · prix inchangé');
      setEditing(false);
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const cancel = useMutation({
    mutationFn: () => api.scheduled.cancel(id, 'changed_plans'),
    onSuccess: () => {
      haptic.success();
      toast('Réservation annulée');
      setConfirmCancel(false);
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  if (q.isLoading) return <Screen header={<Header title="Réservation" onBack={() => router.back()} />}><SkeletonList rows={3} /></Screen>;
  if (q.isError || !b) return <Screen header={<Header title="Réservation" onBack={() => router.back()} />}><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const open = b.status === 'scheduled';
  const cutoffPassed = Date.parse(b.pickupAt) - Date.now() < 60 * 60_000;

  return (
    <Screen
      testID="scheduled-detail"
      header={<Header title={open ? 'Réservation enregistrée' : SCHEDULED_STATUS_LABELS[b.status]} subtitle={b.id} onBack={() => (router.canGoBack() ? router.back() : router.dismissTo('/trips'))} />}
      footer={
        open ? (
          <>
            <Button label="Modifier l’horaire" full variant="secondary" disabled={cutoffPassed} disabledReason={cutoffPassed ? 'Modification possible jusqu’à 1 h avant le départ.' : undefined} onPress={() => { setDay(parts!.date); setTime(parts!.time); setEditing(true); }} testID="modify-scheduled" />
            <Button label="Annuler la réservation" full variant="ghost" onPress={() => setConfirmCancel(true)} testID="cancel-scheduled" />
          </>
        ) : b.rideId ? (
          <Button label="Voir la course" full onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: b.rideId! } })} />
        ) : undefined
      }
    >
      <View style={{ gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <StatusPill tone={b.status === 'cancelled' ? 'danger' : b.status === 'scheduled' ? 'info' : 'neutral'} label={SCHEDULED_STATUS_LABELS[b.status]} />
        </View>
        {open ? <StatusBanner tone="info" title="Aucune chauffeuse n’est encore confirmée" message="Votre trajet est enregistré. La recherche commence 15 minutes avant le départ ; nous vous préviendrons dès qu’une chauffeuse accepte." /> : null}
        <ListGroup>
          <ListRow title={formatDateTime(b.pickupAt)} subtitle="Heure de Rabat" leading={<IconDisc><CalendarClock size={18} color={colors.accent} /></IconDisc>} />
          <ListRow title={b.route.stops.map((s) => s.label).join(' → ')} subtitle={b.route.stops[0]!.address} leading={<IconDisc><RouteIcon size={18} color={colors.accent} /></IconDisc>} />
          <ListRow title={b.paymentMethod.label} subtitle="Moyen de paiement" leading={<IconDisc><CreditCard size={18} color={colors.accent} /></IconDisc>} />
        </ListGroup>
        <Card>
          <FareBreakdown fare={b.terms.breakdown} distanceMeters={b.route.distanceMeters} durationSeconds={b.route.durationSeconds} dynamicReason={b.terms.dynamic?.reason} />
        </Card>
        <Text variant="caption" tone="muted">Prix gelé à la réservation : {formatMoney(b.terms.breakdown.total)}, même si les tarifs changent.</Text>
        <ListGroup label="Historique">
          {b.history.map((h, i) => (
            <ListRow key={i} title={h.label} subtitle={formatShort(h.at)} />
          ))}
        </ListGroup>
      </View>
      <Sheet visible={editing} onClose={() => setEditing(false)} title="Modifier l’horaire" subtitle="Le prix reste celui de la réservation." footer={<Button label="Enregistrer le nouvel horaire" full loading={modify.isPending} disabled={!time} onPress={() => modify.mutate()} testID="save-schedule" />}>
        <SchedulePicker day={day} time={time} onDay={setDay} onTime={setTime} />
      </Sheet>
      <ConfirmDialog visible={confirmCancel} title="Annuler cette réservation ?" message="Aucune chauffeuse n’est encore assignée : l’annulation est gratuite." confirmLabel="Oui, annuler la réservation" cancelLabel="Garder la réservation" destructive loading={cancel.isPending} onConfirm={() => cancel.mutate()} onCancel={() => setConfirmCancel(false)} testID="confirm-cancel-scheduled" />
    </Screen>
  );
}
