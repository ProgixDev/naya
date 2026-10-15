import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeadline } from '@naya/api/react';
import { colors, radius, shadow, themedStyles } from '@naya/tokens';
import { useTheme } from '../../core/theme';
import { Text } from '../../Text';
import { TextButton } from '../../Button';
import { Sheet } from '../../BottomSheet';
import { PressableScale } from '../../PressableScale';
import { useToastAnchor } from '../../Toast';
import { useFamily } from './hooks';
import { ApprovalCard, ApprovalRing, approvalWindowSeconds, formatCountdown, PhaseAnnouncer } from './parts';

const s = themedStyles(() => ({
  wrap: { position: 'absolute' as const, left: 16, right: 16 },
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    ...shadow.float,
  },
}));

const GAP = 8;

/**
 * A parent's start request, wherever she is in the app (P-62): a banner pinned under the status
 * bar with the countdown ring, which opens the pick-up photo and the answers in a sheet. It never
 * changes the route, so a passenger on her own ride keeps her screen, her contact and SOS controls.
 * `hidden(tripId)` hides it where the approval card is already on screen (Famille home, that trip).
 * Toasts move below it while it shows. `offset` drops it below a screen's pinned top controls (the
 * ride's back button and safety disc), so it never covers SOS.
 */
export function FamilleApprovalBanner({ accountId, hidden, onOpenTrip, offset = 0 }: { accountId: string; hidden?: (tripId: string) => boolean; onOpenTrip?: (tripId: string) => void; offset?: number }) {
  useTheme();
  const insets = useSafeAreaInsets();
  const family = useFamily(accountId, !!accountId);
  const trip = family.data?.trips.find((t) => t.status === 'awaiting_approval' && t.approval?.status === 'pending') ?? null;
  const approval = trip?.approval ?? null;
  const { seconds, expired } = useDeadline(approval?.expiresAt ?? null, 500);
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const show = !!trip && !expired && !(hidden?.(trip.id) ?? false);
  const top = insets.top + GAP + offset;
  useToastAnchor(show && height ? { top: top + height + GAP } : null, show);
  if (!trip || !approval) return null;
  const driverFirst = trip.driverName.split(' ')[0];
  const urgent = seconds <= 30;
  return (
    <>
      {show ? (
        <View pointerEvents="box-none" style={[s.wrap, { top }]} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
          <PressableScale
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Départ de ${trip.childName} à approuver. ${driverFirst} attend votre accord, ${formatCountdown(seconds)} pour répondre.`}
            accessibilityHint="Ouvre la photo de prise en charge et les réponses"
            style={s.banner}
            testID="famille-approval-banner"
          >
            <ApprovalRing seconds={seconds} total={approvalWindowSeconds(approval)} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" weight="semibold" numberOfLines={2}>
                Départ de {trip.childName} à approuver
              </Text>
              <Text variant="caption" weight="semibold" tone={urgent ? 'danger' : 'muted'} numeric testID="famille-approval-banner-countdown">
                Répondez dans {formatCountdown(seconds)}
              </Text>
            </View>
            <Text variant="label" weight="semibold" tone="accent">
              Répondre
            </Text>
          </PressableScale>
          {/* Same sentence as the card's first phase: said once even when both are mounted. */}
          <PhaseAnnouncer message={`${driverFirst} demande à démarrer. Vérifiez la photo puis répondez.`} />
        </View>
      ) : null}
      <Sheet visible={open && show} onClose={() => setOpen(false)} title={`Départ de ${trip.childName}`} testID="famille-approval-sheet">
        <View style={{ gap: 12 }}>
          <ApprovalCard trip={trip} accountId={accountId} embedded onDone={() => setOpen(false)} />
          {onOpenTrip ? (
            <TextButton
              label="Voir le trajet"
              onPress={() => {
                setOpen(false);
                onOpenTrip(trip.id);
              }}
              testID="famille-approval-open-trip"
            />
          ) : null}
        </View>
      </Sheet>
    </>
  );
}
