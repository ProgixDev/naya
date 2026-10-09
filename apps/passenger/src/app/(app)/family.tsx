import { useCallback } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { FamilyScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';
export default function Family() {
  const me = useMe();
  // Each step of a child trip (en route, arrived, picked up, alerts…) also reaches the system tray.
  const notify = useCallback((title: string) => {
    Notifications.scheduleNotificationAsync({ content: { title: 'Naya Famille', body: title }, trigger: null }).catch(() => undefined);
  }, []);
  return <FamilyScreen accountId={me.data?.user.id ?? 'passenger'} role="passenger" onBack={() => router.back()} onNotify={notify} />;
}
