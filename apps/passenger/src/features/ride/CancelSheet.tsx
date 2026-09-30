import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, isApiError, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatMoney, PASSENGER_CANCEL_REASONS, type Ride } from '@naya/domain';
import { Button, Pill, Sheet, Skeleton, StatusBanner, Text, haptic, toast, useSingleFlight } from '@naya/ui';
import { useAccountId } from '@/lib/queries';

/**
 * Reason first, fee visible before confirmation. The fee shown is sent back as
 * `acknowledgedFee`; if it changed meanwhile the server refuses and the new fee is shown.
 */
export function CancelSheet({ ride, visible, onClose, onCancelled }: { ride: Ride; visible: boolean; onClose: () => void; onCancelled: (r: Ride) => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const [reason, setReason] = useState<string | null>(null);
  const preview = useQuery({ queryKey: qk.cancellationPreview(a, ride.id), queryFn: () => api.rides.cancellationPreview(ride.id), enabled: visible, refetchInterval: visible ? 5000 : false });
  useEffect(() => {
    if (!visible) setReason(null);
  }, [visible]);
  const cancel = useSingleFlight((_v: void, key: string) => api.rides.cancel(ride.id, { reasonCode: reason!, acknowledgedFee: preview.data!.fee }, key), {
    onSuccess: (r) => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.activeRide(a) });
      onCancelled(r);
    },
    onError: (e) => {
      haptic.error();
      cancel.reset();
      if (isApiError(e) && e.code === 'CONFLICT') preview.refetch();
      toast(errorMessage(e), 'danger');
    },
  });
  const fee = preview.data?.fee ?? 0;
  return (
    <Sheet visible={visible} onClose={onClose} dismissible={!cancel.isPending} title="Annuler la course ?" subtitle="Dites-nous pourquoi. Cela nous aide à améliorer le service." testID="cancel-sheet">
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
          {PASSENGER_CANCEL_REASONS.map((r) => (
            <Pill key={r.code} label={r.label} selected={reason === r.code} onPress={() => setReason(r.code)} testID={`reason-${r.code}`} />
          ))}
        </View>
        {preview.isLoading ? (
          <Skeleton height={64} radius={16} />
        ) : preview.data ? (
          <StatusBanner tone={fee > 0 ? 'warning' : 'success'} title={fee > 0 ? `Frais d’annulation : ${formatMoney(fee)}` : 'Annulation gratuite'} message={preview.data.explanation} testID="cancel-fee" />
        ) : null}
        <Button
          label={fee > 0 ? `Annuler et payer ${formatMoney(fee)}` : 'Annuler sans frais'}
          variant="danger"
          full
          disabled={!reason || !preview.data}
          disabledReason={!reason ? 'Choisissez un motif.' : undefined}
          loading={cancel.isPending}
          onPress={() => cancel.run()}
          testID="confirm-cancel"
        />
        <Button label="Garder ma course" variant="ghost" full onPress={onClose} disabled={cancel.isPending} />
        <Text variant="micro" tone="muted" align="center">
          {ride.paymentMethod.kind === 'card' ? 'Les frais éventuels sont débités sur la carte de la course.' : 'Les frais éventuels sont à régler avec votre prochaine course.'}
        </Text>
      </View>
    </Sheet>
  );
}
