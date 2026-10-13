import { router, useLocalSearchParams } from 'expo-router';
import { FamilleFollowScreen } from '@naya/ui';

/** Public follow link for an invited co-parent (no sign-in; the token is the credential). */
export default function Follow() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <FamilleFollowScreen token={token} onClose={router.canGoBack() ? () => router.back() : undefined} />;
}
