import { router } from 'expo-router';
import { DossierHub } from '@/components/DossierHub';

export default function DocsStart() {
  return <DossierHub onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
