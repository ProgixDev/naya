import { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, PASSENGER_CANCEL_REASONS, paymentMethodPresentation, type Ride } from '@naya/domain';
import { Button, ListGroup, ListRow, Sheet, Skeleton, StatusBanner, Text, TextButton, haptic, toast, useSingleFlight, useTheme } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/** Sent when cancelling is free: no reason is asked for then (audit P-59). */
const FREE_REASON = 'other';

/**
 * Keeping the ride is the filled action; cancelling is red text (P-59, principle 1). The fee is
 * visible before confirmation and is sent back as `acknowledgedFee`; if it changed meanwhile the
 * server refuses and the new fee is shown. A reason is asked for only when cancelling costs
 * something, as radio rows (X-08).
 */
export function CancelSheet({ ride, visible, onClose, onCancelled }: { ride: Ride; visible: boolean; onClose: () => void; onCancelled: (r: Ride) => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const [reason, setReason] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const preview = useQuery({ queryKey: qk.cancellationPreview(a, ride.id), queryFn: () => api.rides.cancellationPreview(ride.id), enabled: visible, refetchInterval: visible ? 5000 : false });
  const fee = preview.data?.fee ?? 0;
  const paid = fee > 0;
  const cancel = useSingleFlight((_v: void, key: string) => api.rides.cancel(ride.id, { reasonCode: paid ? reason! : (reason ?? FREE_REASON), acknowledgedFee: preview.data!.fee }, key), {
    onSuccess: (r) => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.activeRide(a) });
      // A wallet ride releases its hold and may debit the fee: the balance changed on the server.
      if (ride.paymentMethod.kind === 'wallet') qc.invalidateQueries({ queryKey: ['naya', a, 'passenger-wallet'] });
      onCancelled(r);
    },
    onError: (e) => {
      haptic.error();
      cancel.reset();
      if (isApiError(e) && e.code === 'CONFLICT') preview.refetch();
      toast(errorMessage(e), 'danger');
    },
  });
  const close = () => {
    setReason(null);
    setMissing(false);
    onClose();
  };
  const confirm = () => {
    if (cancel.isPending || !preview.data) return;
    if (paid && !reason) {
      // The unblocking step is right above: say which one instead of greying the action out.
      haptic.warning();
      setMissing(true);
      return;
    }
    cancel.run();
  };
  return (
    <Sheet
      visible={visible}
      onClose={close}
      dismissible={!cancel.isPending}
      title="Annuler la course ?"
      subtitle={paid ? 'Choisissez un motif.' : undefined}
      footer={
        <>
          <Button label="Garder ma course" full onPress={close} disabled={cancel.isPending} testID="keep-ride" />
          <TextButton
            label={cancel.isPending ? 'Annulation…' : paid ? `Annuler et payer ${formatMoney(fee)}` : 'Annuler sans frais'}
            tone="danger"
            onPress={confirm}
            testID="confirm-cancel"
          />
        </>
      }
      testID="cancel-sheet"
    >
      <View style={{ gap: 12 }}>
        {preview.isLoading ? (
          <Skeleton height={44} radius={16} />
        ) : preview.data ? (
          <StatusBanner tone={paid ? 'warning' : 'success'} title={paid ? `Frais : ${formatMoney(fee)}` : 'Annulation gratuite'} message={preview.data.explanation} testID="cancel-fee" />
        ) : null}
        {paid ? (
          <ListGroup label="Motif">
            {PASSENGER_CANCEL_REASONS.map((r) => (
              <ListRow
                key={r.code}
                title={r.label}
                selected={reason === r.code}
                onPress={() => {
                  setReason(r.code);
                  setMissing(false);
                }}
                testID={`reason-${r.code}`}
              />
            ))}
          </ListGroup>
        ) : null}
        {missing ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" testID="cancel-reason-missing">
            Choisissez un motif pour annuler.
          </Text>
        ) : null}
        {/* P14, PAX-16: where the fee goes, per method, as the server charges it (rides.ts chargeFee). */}
        {paid ? (
          <Text variant="caption" tone="muted" testID="cancel-fee-method">
            {paymentMethodPresentation(ride.paymentMethod).cancellationFee}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
