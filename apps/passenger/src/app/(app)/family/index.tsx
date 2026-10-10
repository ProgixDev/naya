import { useCallback } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { FamilyHubScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';

export default function Family() {
  const me = useMe();
  // Each step of a child trip (en route, arrived, picked up, alerts…) also reaches the system tray.
  const notify = useCallback((title: string) => {
    Notifications.scheduleNotificationAsync({ content: { title: 'Naya Famille', body: title }, trigger: null }).catch(() => undefined);
  }, []);
  return (
    <FamilyHubScreen
      accountId={me.data?.user.id ?? 'passenger'}
      onBack={() => router.back()}
      onNotify={notify}
      nav={{
        plans: () => router.push('/family/plans'),
        child: (id) => router.push(id ? { pathname: '/family/child', params: { id } } : '/family/child'),
        planTrip: () => router.push('/family/plan-trip'),
        trip: (id) => router.push({ pathname: '/family/trip/[id]', params: { id } }),
      }}
    />
  );
}
