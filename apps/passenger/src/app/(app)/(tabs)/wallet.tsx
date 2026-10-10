import { router } from 'expo-router';
import { PassengerWalletScreen } from '@naya/ui';
import { useAccountId, useMe } from '@/lib/queries';
import { useTabBarSpace } from '@/components/TabBar';

export default function Wallet() {
  const me = useMe();
  const a = useAccountId();
  const space = useTabBarSpace();
  return <PassengerWalletScreen accountId={a} cityId={me.data?.user.cityId ?? 'rabat'} bottomSpace={space} onManagePayments={() => router.push('/payments')} />;
}
