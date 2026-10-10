import { useTheme, Button, ConfirmDialog, ErrorState, FareBreakdown, Header, PressableScale, Screen, Sheet, SkeletonList, Text, haptic, toast } from '@naya/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, CreditCard, Lock } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { casablancaLocalToUtc, formatMoney, formatShort, formatTime, SCHEDULED_STATUS_LABELS, toCasablancaParts } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';
import { SchedulePicker } from '@/features/schedule/SchedulePicker';

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

  const goBack = () => (router.canGoBack() ? router.back() : router.dismissTo('/trips'));
  const plainHeader = <Header title="Réservation" onBack={goBack} />;

  if (q.isLoading) return <Screen header={plainHeader}><SkeletonList rows={3} /></Screen>;
  if (q.isError || !b) return <Screen header={plainHeader}><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const open = b.status === 'scheduled';
  const cutoffPassed = Date.parse(b.pickupAt) - now < 60 * 60_000;
  const stops = b.route.stops;
  const short = (label: string) => label.replace(/^[^·]+·\s*/, '');
  const minutesLeft = Math.round((Date.parse(b.pickupAt) - now) / 60_000);
  const countdown = minutesLeft <= 0 ? 'Départ imminent' : minutesLeft < 60 ? `Dans ${minutesLeft} min` : minutesLeft < 24 * 60 ? `Dans ${Math.floor(minutesLeft / 60)} h ${String(minutesLeft % 60).padStart(2, '0')}` : `Dans ${Math.round(minutesLeft / (24 * 60))} j`;
  const when = new Date(b.pickupAt);
  const tz = { timeZone: 'Africa/Casablanca' } as const;
  const dayNum = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', ...tz }).format(when);
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', ...tz }).format(when).replace('.', '');
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...tz }).format(when);
  const card = { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 14, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 } as const;
  const label12 = { fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' as const, marginLeft: 4 };
  const tone = open ? { bg: colors.warningSoft, fg: colors.warning, text: 'Chauffeuse à confirmer' } : b.status === 'cancelled' ? { bg: colors.dangerSoft, fg: colors.danger, text: SCHEDULED_STATUS_LABELS[b.status] } : b.status === 'dispatched' ? { bg: colors.successSoft, fg: colors.success, text: SCHEDULED_STATUS_LABELS[b.status] } : { bg: colors.background, fg: colors.muted, text: SCHEDULED_STATUS_LABELS[b.status] };

  return (
    <Screen
      testID="scheduled-detail"
      header={<Header title={open ? 'Réservation' : SCHEDULED_STATUS_LABELS[b.status]} onBack={goBack} />}
      footer={
        open ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Annuler" variant="secondary" style={{ flex: 1 }} full onPress={() => { haptic.select(); setConfirmCancel(true); }} testID="cancel-scheduled" />
              <Button label="Modifier l’horaire" style={{ flex: 1.3 }} full disabled={cutoffPassed} onPress={() => { setDay(parts!.date); setTime(parts!.time); setEditing(true); }} testID="modify-scheduled" />
            </View>
            {cutoffPassed ? <Text tone="muted" align="center" style={{ fontSize: 12, lineHeight: 16 }}>Modification possible jusqu’à 1 h avant le départ.</Text> : null}
          </View>
        ) : b.rideId ? (
          <Button label="Voir la course" size="major" full onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: b.rideId! } })} />
        ) : undefined
      }
    >
      <View style={{ gap: 14, marginTop: 4 }}>
        {/* ── When + status ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 60, height: 64, borderRadius: 16, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight="bold" numeric tone="accent" style={{ fontSize: 24, lineHeight: 28 }}>{dayNum}</Text>
              <Text weight="semibold" tone="accent" style={{ fontSize: 11, lineHeight: 14, textTransform: 'uppercase' }}>{month}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="bold" numeric style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.5 }}>{formatTime(b.pickupAt)}</Text>
              <Text tone="muted" style={{ fontSize: 14, lineHeight: 19, textTransform: 'capitalize' }}>{weekday}</Text>
            </View>
            {open ? <Text weight="semibold" tone="accent" numeric style={{ fontSize: 13, lineHeight: 18 }}>{countdown}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: tone.bg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone.fg }} />
            <View style={{ flex: 1 }}>
              <Text weight="semibold" style={{ fontSize: 14, lineHeight: 19, color: tone.fg }}>{tone.text}</Text>
              {open ? <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>Aucune chauffeuse n’est encore confirmée · recherche 15 min avant le départ</Text> : null}
            </View>
          </View>
        </View>

        {/* ── Route ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
              <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: colors.line, marginVertical: 3 }} />
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.ink }} />
            </View>
            <View style={{ flex: 1, gap: 14 }}>
              <View>
                <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>Départ</Text>
                <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{short(stops[0]!.label)}</Text>
                {stops[0]!.address ? <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{stops[0]!.address}</Text> : null}
              </View>
              {stops.length > 2 ? <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{stops.length - 2} arrêt : {stops.slice(1, -1).map((x) => short(x.label)).join(', ')}</Text> : null}
              <View>
                <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>Arrivée</Text>
                <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{short(stops[stops.length - 1]!.label)}</Text>
                {stops[stops.length - 1]!.address ? <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{stops[stops.length - 1]!.address}</Text> : null}
              </View>
            </View>
          </View>
        </View>

        {/* ── Price ── */}
        <PressableScale onPress={() => { haptic.select(); setFareOpen(true); }} testID="scheduled-fare" accessibilityRole="button" accessibilityLabel={`${b.paymentMethod.label}, Prix gelé ${formatMoney(b.terms.breakdown.total)}`} pressedScale={0.985} style={[card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}><CreditCard size={20} color={colors.accent} strokeWidth={1.9} /></View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{b.paymentMethod.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Lock size={12} color={colors.success} strokeWidth={2.2} />
              <Text tone="success" weight="medium" style={{ fontSize: 13, lineHeight: 18 }}>Prix gelé à la réservation</Text>
            </View>
          </View>
          <Text weight="bold" numeric style={{ fontSize: 17, lineHeight: 22 }}>{formatMoney(b.terms.breakdown.total)}</Text>
          <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
        </PressableScale>

        {/* ── Timeline ── */}
        {b.history.length > 0 ? (
          <View style={{ gap: 10, marginTop: 6 }}>
            <Text weight="semibold" tone="muted" style={label12}>Suivi</Text>
            <View style={[card, { gap: 0 }]}>
              {b.history.slice().reverse().map((h, i, all) => (
                <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center', width: 12 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: i === 0 ? colors.accent : colors.line }} />
                    {i < all.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: colors.line, marginVertical: 2 }} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: i < all.length - 1 ? 14 : 0, gap: 2 }}>
                    <Text weight={i === 0 ? 'semibold' : 'regular'} style={{ fontSize: 14, lineHeight: 20 }}>{h.label}</Text>
                    <Text tone="muted" numeric style={{ fontSize: 12, lineHeight: 16 }}>{formatShort(h.at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <Text tone="muted" align="center" numeric style={{ fontSize: 12, lineHeight: 16 }}>Réservation {b.id} · heure de Rabat</Text>
      </View>

      <Sheet visible={fareOpen} onClose={() => setFareOpen(false)} title="Détail du prix" subtitle="Gelé à la réservation, même si les tarifs changent.">
        <FareBreakdown fare={b.terms.breakdown} distanceMeters={b.route.distanceMeters} durationSeconds={b.route.durationSeconds} dynamicReason={b.terms.dynamic?.reason} />
      </Sheet>
      <Sheet visible={editing} onClose={() => setEditing(false)} title="Modifier l’horaire" subtitle="Le prix reste celui de la réservation." footer={<Button label="Enregistrer le nouvel horaire" full loading={modify.isPending} disabled={!time} onPress={() => modify.mutate()} testID="save-schedule" />}>
        <SchedulePicker day={day} time={time} onDay={setDay} onTime={setTime} />
      </Sheet>
      <ConfirmDialog visible={confirmCancel} title="Annuler cette réservation ?" message="Aucune chauffeuse n’est encore assignée : l’annulation est gratuite." confirmLabel="Oui, annuler la réservation" cancelLabel="Garder la réservation" destructive loading={cancel.isPending} onConfirm={() => cancel.mutate()} onCancel={() => setConfirmCancel(false)} testID="confirm-cancel-scheduled" />
    </Screen>
  );
}
