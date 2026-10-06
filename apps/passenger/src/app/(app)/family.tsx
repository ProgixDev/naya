import { router } from 'expo-router';
import { FamilyScreen } from '@naya/ui';
import { useMe } from '@/lib/queries';
export default function Family() { const me=useMe(); return <FamilyScreen accountId={me.data?.user.id ?? 'passenger'} role="passenger" onBack={()=>router.back()} />; }
