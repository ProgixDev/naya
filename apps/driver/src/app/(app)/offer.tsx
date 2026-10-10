import { useTheme , Button, CountdownRing, Money, NayaMap, Pill, Sheet, StatusBanner, Text, haptic, useSingleFlight } from '@naya/ui';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CircleSlash, Clock3, CreditCard, MapPin, Navigation, Route, Wallet, XCircle } from 'lucide-react-native';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi, useDeadline } from '@naya/api/react';
import { formatDistance, formatDuration, formatMoney, OFFER_DECLINE_REASONS, type DriverOffer } from '@naya/domain';
import { colors, gutter, shadow } from '@naya/tokens';
import { useAccountId, useDriverStatus } from '@/lib/queries';

type Phase = 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | 'taken';

/** D07 · D07-10 · D07-timer-* · D07-declined · D07-expired · D07-withdrawn */
export default function OfferScreen() {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const insets = useSafeAreaInsets();
  const status = useDriverStatus();
  const [snapshot, setSnapshot] = useState<DriverOffer | null>(status.data?.offer ?? null);
  const [localPhase, setLocalPhase] = useState<Phase | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState<string>('too_far');
  const warned = useRef(false);

  // Keep the offer we are showing; update it with the server's view of the same offer.
  const currentOffer = status.data?.offer;
  if (currentOffer && currentOffer !== snapshot && (!snapshot || currentOffer.id === snapshot.id || snapshot.status !== 'pending')) setSnapshot(currentOffer);

  const offer = snapshot;
  const { seconds, expired } = useDeadline(offer?.status === 'pending' ? offer.expiresAt : null);
  useEffect(() => {
    if (offer?.status === 'pending' && seconds === 10 && !warned.current) {
      warned.current = true;
      haptic.warning();
    }
  }, [seconds, offer?.status]);

  const accept = useSingleFlight((id: string, key) => api.driver.acceptOffer(id, key), {
    onSuccess: () => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
      router.replace('/ride');
    },
    onError: (e) => {
      haptic.error();
      if (isApiError(e) && e.code === 'OFFER_EXPIRED') setLocalPhase('expired');
      else if (isApiError(e) && (e.code === 'RIDE_ALREADY_ASSIGNED' || e.code === 'OFFER_NOT_PENDING')) setLocalPhase('taken');
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
  });
  const decline = useMutation({
    mutationFn: () => api.driver.declineOffer(offer!.id, reason),
    onSuccess: (o) => {
      setSnapshot(o);
      setDeclineOpen(false);
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
    onError: (e) => {
      setDeclineOpen(false);
      setLocalPhase(isApiError(e) && e.code === 'OFFER_NOT_PENDING' ? 'withdrawn' : null);
      qc.invalidateQueries({ queryKey: qk.driverStatus(a) });
    },
  });

  const phase: Phase = localPhase ?? (offer?.status === 'pending' ? 'pending' : ((offer?.status as Phase) ?? 'withdrawn'));
  const back = () => (router.canGoBack() ? router.back() : router.dismissTo('/'));

  if (!offer) {
    return (
      <Terminal insetsTop={insets.top} icon={<CircleSlash size={26} color={colors.accent} />} title="Aucune proposition" message="Restez en ligne : la prochaine course s’affichera ici." onBack={back} />
    );
  }
  if (phase !== 'pending' || (phase === 'pending' && offer.status !== 'pending')) {
    const t = {
      accepted: { title: 'Course acceptée', message: 'Le guidage vers la passagère est prêt.', icon: <Clock3 size={26} color={colors.success} />, cta: { label: 'Rejoindre la passagère', onPress: () => router.replace('/ride') } },
      declined: { title: 'Proposition refusée', message: 'Vous restez en ligne. Une autre chauffeuse reçoit cette course.', icon: <XCircle size={26} color={colors.accent} /> },
      expired: { title: 'Proposition expirée', message: 'Le délai de 30 secondes est écoulé. Aucune course n’a été acceptée automatiquement.', icon: <Clock3 size={26} color={colors.warning} /> },
      withdrawn: { title: 'Proposition retirée', message: 'La passagère a annulé sa demande avant votre réponse.', icon: <CircleSlash size={26} color={colors.accent} /> },
      taken: { title: 'Course déjà attribuée', message: 'Cette course n’est plus disponible. Vous restez en ligne.', icon: <CircleSlash size={26} color={colors.accent} /> },
    }[phase === 'pending' ? 'expired' : phase];
    return <Terminal insetsTop={insets.top} testID={`offer-${phase}`} icon={t.icon} title={t.title} message={t.message} onBack={back} cta={'cta' in t ? t.cta : undefined} online={phase !== 'accepted'} />;
  }

  const stops = offer.route.stops;
  const pickup = stops[0]!;
  const destination = stops[stops.length - 1]!;
  const via = stops.slice(1, -1).map((s) => s.label);
  const timeUp = expired;
  return (
    <View style={{ flex: 1, backgroundColor: colors.map }} testID="offer-pending">
      <NayaMap
        center={pickup.location}
        route={offer.route.polyline}
        fitTo={offer.route.polyline}
        markers={stops.map((s, i) => ({ id: `s${i}`, kind: i === 0 ? 'pickup' : i === stops.length - 1 ? 'destination' : 'stop', coordinate: s.location, label: s.label }))}
        bottomInset={540}
        topInset={insets.top}
        interactive={false}
      />
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface, borderRadius: 30, padding: 18, gap: 16, ...shadow.float }}>
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.selected }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} />
              <Text weight="semibold" tone="accent" style={{ fontSize: 12, lineHeight: 16 }}>{offer.service?.name ? `${offer.service.name} · ` : ''}À {formatDistance(offer.pickupDistanceMeters)} de vous</Text>
            </View>
            <Text weight="bold" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}>Nouvelle course</Text>
          </View>
          <View testID="offer-countdown" style={{ flexShrink: 0 }}>
            <CountdownRing seconds={seconds} total={30} />
          </View>
        </View>

        {/* ── Fare ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <View testID="offer-fare">
            <Money amount={offer.fare} variant="display" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: offer.paymentKind === 'cash' ? colors.successSoft : colors.infoSoft, marginBottom: 8 }}>
            {offer.paymentKind === 'cash' ? <Banknote size={16} color={colors.success} /> : <CreditCard size={16} color={colors.info} />}
            <Text weight="semibold" style={{ fontSize: 13, lineHeight: 18, color: offer.paymentKind === 'cash' ? colors.success : colors.info }}>
              {offer.paymentKind === 'cash' ? 'Espèces' : offer.paymentKind === 'card' ? 'Carte' : 'Portefeuille'}
            </Text>
          </View>
        </View>

        {/* ── Key figures ── */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Fig icon={<Navigation size={15} color={colors.accent} strokeWidth={2} />} label="Prise en charge" value={`${formatDuration(offer.pickupEtaSeconds)} · ${formatDistance(offer.pickupDistanceMeters)}`} />
          <Fig icon={<Route size={15} color={colors.accent} strokeWidth={2} />} label="Trajet" value={`${formatDistance(offer.route.distanceMeters)} · ${formatDuration(offer.route.durationSeconds)}`} />
        </View>

        {/* ── Route ── */}
        <View style={{ flexDirection: 'row', gap: 14, backgroundColor: colors.background, borderRadius: 18, padding: 14 }}>
          <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 4 }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 4, borderColor: colors.accent, backgroundColor: colors.surface }} />
            <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: colors.line, marginVertical: 3 }} />
            <MapPin size={18} color={colors.surface} fill={colors.ink} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <View>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{pickup.label}</Text>
              <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{pickup.address}</Text>
            </View>
            <View>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{destination.label}{via.length ? ` · via ${via.join(', ')}` : ''}</Text>
              <Text tone="muted" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>{destination.address}{via.length ? ` · ${via.length} arrêt${via.length > 1 ? 's' : ''}` : ''}</Text>
            </View>
          </View>
        </View>

        {/* ── Net ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.successSoft, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 }} accessible accessibilityLabel={`Votre revenu net estimé ${formatMoney(offer.estimatedNet)}, commission ${formatMoney(offer.commission)}`}>
          <Wallet size={20} color={colors.success} strokeWidth={1.9} />
          <View style={{ flex: 1 }}>
            <Text weight="semibold" style={{ fontSize: 14, lineHeight: 19 }}>Votre revenu net estimé</Text>
            <Text tone="muted" numeric style={{ fontSize: 12, lineHeight: 16 }}>Commission Naya {formatMoney(offer.commission)}{offer.paymentKind === 'cash' ? ' · débitée du portefeuille' : ''}</Text>
          </View>
          <View testID="offer-net" style={{ flexShrink: 0 }}>
            <Text weight="bold" numeric tone="success" style={{ fontSize: 20, lineHeight: 26 }}>{formatMoney(offer.estimatedNet)}</Text>
          </View>
        </View>

        {accept.isError && !localPhase ? <StatusBanner tone="danger" title="Acceptation impossible" message={errorMessage(accept.error)} /> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Refuser" variant="secondary" size="major" style={{ flex: 1 }} full onPress={() => setDeclineOpen(true)} testID="decline-offer" />
          <Button label={timeUp ? 'Délai écoulé' : 'Accepter'} size="major" style={{ flex: 2 }} full loading={accept.isPending} loadingLabel="Confirmation auprès de Naya…" disabled={timeUp} onPress={() => accept.run(offer.id)} testID="accept-offer" />
        </View>
      </View>

      <Sheet visible={declineOpen} onClose={() => setDeclineOpen(false)} title="Refuser la course" subtitle="Votre motif aide à mieux répartir les courses." footer={<Button label="Confirmer le refus" full loading={decline.isPending} onPress={() => decline.mutate()} testID="confirm-decline" />}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {OFFER_DECLINE_REASONS.map((r) => (
            <Pill key={r.code} label={r.label} selected={reason === r.code} onPress={() => setReason(r.code)} testID={`decline-${r.code}`} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

function Terminal({ icon, title, message, onBack, cta, insetsTop, testID, online = true }: { icon: React.ReactNode; title: string; message: string; onBack: () => void; cta?: { label: string; onPress: () => void }; insetsTop: number; testID?: string; online?: boolean }) {
  useTheme();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insetsTop, paddingHorizontal: gutter }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <View style={{ transform: [{ scale: 1.5 }] }}>{icon}</View>
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 8, paddingHorizontal: 8 }}>
          <Text weight="bold" align="center" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.8 }}>{title}</Text>
          <Text tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22, maxWidth: 320 }}>{message}</Text>
        </View>
        {online ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.successSoft }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }} />
          <Text weight="semibold" tone="success" style={{ fontSize: 13, lineHeight: 18 }}>Vous restez en ligne</Text>
        </View> : null}
      </View>
      <View style={{ paddingBottom: 32, gap: 8 }}>
        {cta ? <Button label={cta.label} size="major" full onPress={cta.onPress} /> : null}
        <Button label="Retour à l’accueil" variant={cta ? 'ghost' : 'primary'} size="major" full onPress={onBack} testID="offer-back" />
      </View>
    </View>
  );
}

function Fig({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  useTheme();
  return (
    <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingVertical: 9, paddingHorizontal: 11, gap: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text tone="muted" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>{label}</Text>
      </View>
      <Text weight="semibold" numeric numberOfLines={1} style={{ fontSize: 14, lineHeight: 19 }}>{value}</Text>
    </View>
  );
}
