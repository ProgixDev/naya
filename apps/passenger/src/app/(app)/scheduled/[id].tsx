import { useTheme, Button, ConfirmDialog, ErrorState, FareBreakdown, Header, Icon, ListGroup, ListRow, Screen, Sheet, SkeletonList, StatusIcon, Text, TextButton, haptic, paymentIcon, toast } from '@naya/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { casablancaLocalToUtc, formatDateTime, formatMoney, formatShort, isRideActive, paymentMethodPresentation, toCasablancaParts } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useAccountId, useRide } from '@/lib/queries';
import { SchedulePicker, useCityScheduling } from '@/features/schedule/SchedulePicker';
import { formatLeadTime } from '@/features/schedule/slots';

/** One line under the hero: what happens next, said once (P-29). */
const NEXT: Record<'scheduled' | 'dispatched' | 'cancelled' | 'expired', string> = {
  scheduled: 'Aucune chauffeuse n’est encore confirmée · recherche 15 min avant le départ',
  dispatched: 'La course a été lancée à l’heure prévue.',
  cancelled: 'Aucun frais n’a été appliqué.',
  expired: 'Aucune chauffeuse n’a pu être trouvée à temps.',
};

/** P12-detail: recorded booking, modify time (price unchanged), cancel (free). */
export default function ScheduledDetail() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const qc = useQueryClient();
  const a = useAccountId();
  const q = useQuery({ queryKey: qk.scheduledOne(a, id), queryFn: () => api.scheduled.get(id), refetchInterval: 15_000 });
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [fareOpen, setFareOpen] = useState(false);
  const b = q.data;
  // PAX-10: the ride a dispatched booking started, so « Voir » opens the live ride or its receipt, never a
  // receipt for a ride that has not happened.
  const ride = useRide(b?.rideId ?? undefined);
  // The booking's own city rules (it may differ from the passenger's current city).
  const scheduling = useCityScheduling(b?.cityId);
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
      toast('Horaire modifié · prix inchangé', 'success');
      setEditing(false);
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const cancel = useMutation({
    mutationFn: () => api.scheduled.cancel(id, 'changed_plans'),
    onSuccess: () => {
      haptic.success();
      toast('Réservation annulée', 'success');
      setConfirmCancel(false);
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  const back = () => (router.canGoBack() ? router.back() : router.dismissTo('/trips'));
  if (q.isLoading) return <Screen header={<Header title="Réservation" onBack={back} />}><SkeletonList rows={3} /></Screen>;
  if (q.isError || !b) return <Screen header={<Header title="Réservation" onBack={back} />}><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const open = b.status === 'scheduled';
  // P14: the method as it really works; a wallet booking already holds the frozen total on the balance.
  const pay = paymentMethodPresentation(b.paymentMethod);
  const cutoffPassed = Date.parse(b.pickupAt) - now < scheduling.modifyCutoffMinutes * 60_000;
  const rideStatus = ride.data?.ride.status;
  const rideLive = !!rideStatus && (isRideActive(rideStatus) || rideStatus === 'no_driver');

  return (
    <Screen
      testID="scheduled-detail"
      header={<Header title="Réservation" subtitle={b.id} onBack={back} />}
      footer={
        open ? (
          // One action (P-28): change the time; cancelling is red text under it.
          <View style={{ gap: 4 }}>
            <Button
              label="Modifier l’horaire"
              full
              disabled={cutoffPassed}
              disabledReason={`Modification possible jusqu’à ${formatLeadTime(scheduling.modifyCutoffMinutes)} avant le départ.`}
              onPress={() => { setDay(parts!.date); setTime(parts!.time); setEditing(true); }}
              testID="modify-scheduled"
            />
            <TextButton label="Annuler la réservation" tone="danger" onPress={() => setConfirmCancel(true)} testID="cancel-scheduled" />
          </View>
        ) : b.rideId ? (
          rideLive ? (
            <Button label="Suivre la course" full onPress={() => router.push('/ride')} testID="scheduled-open-ride" />
          ) : (
            <Button label="Voir le reçu" full loading={ride.isLoading} onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: b.rideId! } })} testID="scheduled-open-receipt" />
          )
        ) : undefined
      }
    >
      <View style={{ gap: 24, marginTop: 4 }}>
        {/* The one status line of the screen (P-10 pattern): state disc with its word, the time, what happens next. */}
        <View style={{ alignItems: 'center', gap: 8 }} testID="scheduled-hero">
          <StatusIcon kind="scheduled" state={b.status} size="lg" variant="disc" showLabel testID="scheduled-status" />
          <Text variant="title" weight="semibold" align="center" numeric>{formatDateTime(b.pickupAt)}</Text>
          <Text variant="caption" tone="muted" align="center">{NEXT[b.status]}</Text>
        </View>
        <ListGroup footnote="Heure du Maroc. Prix gelé à la réservation.">
          <ListRow title={b.route.stops.map((s) => s.label).join(' → ')} subtitle={b.route.stops[0]!.address} />
          <ListRow
            title={pay.label}
            subtitle={`${formatMoney(b.terms.breakdown.total)}${pay.heldAtBooking && open ? ' · réservé sur votre solde' : ''}`}
            leading={<Icon icon={paymentIcon(pay.icon)} size={24} color={colors.ink} />}
            onPress={() => setFareOpen(true)}
            accessibilityHint="Affiche le détail du prix"
            testID="scheduled-fare"
          />
        </ListGroup>
        <ListGroup label="Historique">
          {b.history.map((h, i) => (
            <ListRow key={i} title={h.label} value={formatShort(h.at)} />
          ))}
        </ListGroup>
      </View>
      <Sheet visible={fareOpen} onClose={() => setFareOpen(false)} title="Détail du prix" subtitle="Gelé à la réservation, même si les tarifs changent.">
        <FareBreakdown fare={b.terms.breakdown} distanceMeters={b.route.distanceMeters} durationSeconds={b.route.durationSeconds} dynamicReason={b.terms.dynamic?.reason} />
      </Sheet>
      <Sheet visible={editing} onClose={() => setEditing(false)} title="Modifier l’horaire" subtitle="Le prix reste celui de la réservation." footer={<Button label="Enregistrer le nouvel horaire" full loading={modify.isPending} disabled={!time} onPress={() => modify.mutate()} testID="save-schedule" />}>
        <SchedulePicker cityId={b.cityId} day={day} time={time} onDay={setDay} onTime={setTime} />
      </Sheet>
      <ConfirmDialog visible={confirmCancel} title="Annuler cette réservation ?" message="Aucune chauffeuse n’est encore assignée : l’annulation est gratuite." confirmLabel="Oui, annuler la réservation" cancelLabel="Garder la réservation" destructive loading={cancel.isPending} onConfirm={() => cancel.mutate()} onCancel={() => setConfirmCancel(false)} testID="confirm-cancel-scheduled" />
    </Screen>
  );
}
