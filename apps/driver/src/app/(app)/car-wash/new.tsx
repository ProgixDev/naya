import { router } from 'expo-router';
import { CarWashBookingScreen } from '@naya/ui';
import { useAccountId, useMe } from '@/lib/queries';
import { useForegroundLocation } from '@/lib/location';

/** « Lavage à domicile » · booking, with the car prefilled from the driver's vehicle file. */
export default function CarWashNew() {
  const a = useAccountId();
  const me = useMe();
  const location = useForegroundLocation();
  const locate = async () => {
    const p = await location.request();
    return p === 'denied' ? null : p;
  };
  return (
    <CarWashBookingScreen
      accountId={a}
      role="driver"
      cityId={me.data?.user.cityId ?? 'rabat'}
      vehicle={me.data?.vehicle ?? null}
      locate={locate}
      onBack={() => router.back()}
      onBooked={(id) => router.replace({ pathname: '/car-wash/[id]', params: { id } })}
    />
  );
}
