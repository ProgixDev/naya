import { Backoffice } from '@/components/backoffice';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Espace équipe' };
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  return <Backoffice section={section?.[0] ?? 'overview'} />;
}
