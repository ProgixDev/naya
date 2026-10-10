import { router, useLocalSearchParams } from 'expo-router';
import { FamilyChildScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';
import { usePrefs } from '@/lib/prefs';

/** Add a child (no id) or edit one (?id=). */
export default function FamilyChild() {
  const me = useMe();
  const cityId = usePrefs((s) => s.cityId);
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <FamilyChildScreen accountId={me.data?.user.id ?? 'passenger'} cityId={me.data?.user.cityId ?? cityId} childId={id} onBack={() => router.back()} onDone={() => router.back()} />;
}
