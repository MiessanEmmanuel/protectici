import type { Metadata } from 'next';
import { AdminQuotesView } from '@/components/admin/devis/AdminQuotesView';
import { parseQuoteStatus } from '@/components/admin/devis/filters';

export const metadata: Metadata = {
  title: 'Demandes de devis',
  robots: { index: false, follow: false },
};

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string | string[] }>;
}) {
  const { statut } = await searchParams;
  return <AdminQuotesView initialStatus={parseQuoteStatus(statut)} />;
}
