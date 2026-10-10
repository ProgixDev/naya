import { useTheme, Button, ConfirmDialog, ErrorState, FareBreakdown, PressableScale, Screen, Sheet, SkeletonList, StatusBanner, StatusPill, Text, haptic, toast } from '@naya/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ChevronLeft, ChevronRight, CreditCard, Route as RouteIcon } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { casablancaLocalToUtc, formatDateTime, formatMoney, formatShort, SCHEDULED_STATUS_LABELS, toCasablancaParts } from '@naya/domain';
import { colors, getColorScheme, gutter, radius, shadow } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';
import { SchedulePicker } from '@/features/schedule/SchedulePicker';

/** P12-detail: recorded booking, modify time (price unchanged), cancel (free). */
export default function ScheduledDetail() {
  useTheme();
  const insets = useSafeAreaInsets();
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
  const isDark = getColorScheme() === 'dark';
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

  const loadingOrErrorHeader = (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: gutter, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <PressableScale
          onPress={() => {
            haptic.select();
            if (router.canGoBack()) router.back();
            else router.dismissTo('/trips');
          }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          testID="header-back"
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.card,
          }}
        >
          <ChevronLeft size={24} color={colors.ink} strokeWidth={2.5} />
        </PressableScale>
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            fontFamily: 'Inter_700Bold',
            color: colors.ink,
            letterSpacing: -0.6,
          }}
          accessibilityRole="header"
        >
          Réservation
        </Text>
      </View>
    </View>
  );

  if (q.isLoading) return <Screen header={loadingOrErrorHeader}><SkeletonList rows={3} /></Screen>;
  if (q.isError || !b) return <Screen header={loadingOrErrorHeader}><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const open = b.status === 'scheduled';
  const cutoffPassed = Date.parse(b.pickupAt) - now < 60 * 60_000;

  const detailHeader = (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: gutter, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <PressableScale
          onPress={() => {
            haptic.select();
            if (router.canGoBack()) router.back();
            else router.dismissTo('/trips');
          }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          testID="header-back"
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.card,
          }}
        >
          <ChevronLeft size={24} color={colors.ink} strokeWidth={2.5} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              fontFamily: 'Inter_700Bold',
              color: colors.ink,
              letterSpacing: -0.5,
            }}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {open ? 'Réservation enregistrée' : SCHEDULED_STATUS_LABELS[b.status]}
          </Text>
          {b.id ? (
            <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2, fontFamily: 'Inter_500Medium' }}>
              {b.id}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <Screen
      testID="scheduled-detail"
      header={detailHeader}
      footer={
        open ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <PressableScale
              onPress={() => {
                haptic.select();
                setDay(parts!.date);
                setTime(parts!.time);
                setEditing(true);
              }}
              disabled={cutoffPassed}
              testID="modify-scheduled"
              accessibilityRole="button"
              accessibilityLabel="Modifier l’horaire"
              style={{
                flex: 1.2,
                height: 48,
                borderRadius: radius.pill,
                backgroundColor: isDark ? colors.selected : '#ECE6EA',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: cutoffPassed ? 0.45 : 1,
              }}
            >
              <Text variant="action" weight="bold" style={{ color: cutoffPassed ? colors.muted : colors.ink, fontSize: 15 }}>
                Modifier l’horaire
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                haptic.select();
                setConfirmCancel(true);
              }}
              testID="cancel-scheduled"
              accessibilityRole="button"
              accessibilityLabel="Annuler"
              style={{
                flex: 1,
                height: 48,
                borderRadius: radius.pill,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                alignItems: 'center',
                justifyContent: 'center',
                ...shadow.card,
              }}
            >
              <Text variant="action" weight="bold" style={{ color: colors.accent, fontSize: 15 }}>
                Annuler
              </Text>
            </PressableScale>
          </View>
        ) : b.rideId ? (
          <Button label="Voir la course" size="major" full onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: b.rideId! } })} />
        ) : undefined
      }
    >
      <View style={{ gap: 14, marginTop: 4 }}>
        {open ? (
          <StatusBanner
            compact
            tone="info"
            title="Aucune chauffeuse n’est encore confirmée"
            message="recherche 15 min avant le départ"
            style={{ borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 }}
          />
        ) : (
          <StatusPill tone={b.status === 'cancelled' ? 'danger' : 'neutral'} label={SCHEDULED_STATUS_LABELS[b.status]} />
        )}

        {open && cutoffPassed ? (
          <Text variant="caption" tone="muted" style={{ paddingHorizontal: 4 }}>
            Modification possible jusqu’à 1 h avant le départ.
          </Text>
        ) : null}

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.line,
            overflow: 'hidden',
            ...shadow.card,
          }}
        >
          {/* Date & Time */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: isDark ? colors.selected : '#F9EEF4',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarClock size={22} color={colors.accent} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                {formatDateTime(b.pickupAt)}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>
                Heure de Rabat
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: 16 }} />

          {/* Route */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: isDark ? colors.selected : '#F9EEF4',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RouteIcon size={22} color={colors.accent} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }} numberOfLines={1}>
                {b.route.stops.map((s) => s.label).join(' → ')}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }} numberOfLines={1}>
                {b.route.stops[0]?.address ?? ''}
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: 16 }} />

          {/* Payment Method / Fare */}
          <PressableScale
            onPress={() => {
              haptic.select();
              setFareOpen(true);
            }}
            testID="scheduled-fare"
            accessibilityRole="button"
            accessibilityLabel={`${b.paymentMethod.label}, Prix gelé ${formatMoney(b.terms.breakdown.total)}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: isDark ? colors.selected : '#F9EEF4',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CreditCard size={22} color={colors.accent} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                {b.paymentMethod.label}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>
                {`Prix gelé · ${formatMoney(b.terms.breakdown.total)}`}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
          </PressableScale>
        </View>

        {/* Historique Section */}
        {b.history.length > 0 ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: colors.muted,
                letterSpacing: 1.1,
                textTransform: 'uppercase',
                marginLeft: 6,
              }}
            >
              Historique
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.line,
                padding: 16,
                gap: 12,
                ...shadow.card,
              }}
            >
              {b.history.map((h, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1 }}>
                    {h.label}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    {formatShort(h.at)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
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
