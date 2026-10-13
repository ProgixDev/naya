import { Backoffice } from '@/components/backoffice';
import type { Metadata } from 'next';
// Open demo console (no login, browser-only data): reachable by URL for review, never indexed.
export const metadata: Metadata = {
  title: 'Espace équipe',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  return <Backoffice section={section?.[0] ?? 'overview'} />;
}
