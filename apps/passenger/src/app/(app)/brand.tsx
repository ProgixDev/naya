import { router } from 'expo-router';
import { BrandConceptsScreen } from '@naya/ui';
export default function Brand() { return <BrandConceptsScreen onBack={()=>router.back()}/>; }
