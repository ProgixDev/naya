import { router } from 'expo-router';
import { TrustedContactsScreen } from '@naya/ui';

export default function TrustedContacts() {
  return <TrustedContactsScreen onBack={() => router.back()} />;
}
