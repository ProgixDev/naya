import { router } from 'expo-router';
import { PassengerWalletScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';
export default function Wallet() { const me=useMe(); return <PassengerWalletScreen accountId={me.data?.user.id ?? 'passenger'} cityId={me.data?.user.cityId ?? 'rabat'} onBack={()=>router.back()} />; }
