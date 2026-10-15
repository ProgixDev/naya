import { router } from 'expo-router';
import { CarWashBookingScreen } from '@naya/ui';
import { useAccountId, useMe } from '@/lib/queries';
import { useCityId } from '@/lib/prefs';
import { useForegroundLocation } from '@/features/location/useLocation';

/** « Lavage à domicile » · booking: where, which car, package, slot, payment. */
export default function CarWashNew() {
  const a = useAccountId();
  const me = useMe();
  const cityId = useCityId(); // the server's user.cityId (ADR-0054, PAX-05)
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
