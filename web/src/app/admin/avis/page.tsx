import type { Metadata } from 'next';
import { AdminReviewsView } from '@/components/admin/avis/AdminReviewsView';

export const metadata: Metadata = {
  title: 'Avis et signalements',
  robots: { index: false, follow: false },
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string | string[] }>;
}) {
  const { onglet } = await searchParams;
  return <AdminReviewsView initialTab={onglet === 'signalements' ? 'reports' : 'reviews'} />;
}
