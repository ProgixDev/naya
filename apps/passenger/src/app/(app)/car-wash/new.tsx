import { router } from 'expo-router';
import { CarWashBookingScreen } from '@naya/ui';
import { useAccountId, useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';
import { useForegroundLocation } from '@/features/location/useLocation';

/** « Lavage à domicile » · booking: where, which car, package, slot, payment. */
export default function CarWashNew() {
  const a = useAccountId();
  const me = useMe();
  const cityId = usePrefs((s) => s.cityId);
  const loc = useForegroundLocation();
  return (
    <CarWashBookingScreen
      accountId={a}
      role="passenger"
      cityId={cityId}
      savedPlaces={me.data?.user.savedPlaces ?? []}
      locate={loc.locate}
      onBack={() => router.back()}
      onBooked={(id) => router.replace({ pathname: '/car-wash/[id]', params: { id } })}
    />
  );
}
