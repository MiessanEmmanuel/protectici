import type { Metadata } from 'next';
import { AdminFeedbackView } from '@/components/admin/feedback/AdminFeedbackView';
import { parseFeedbackStatus } from '@/components/admin/feedback/filters';

export const metadata: Metadata = {
  title: 'Dis-moi tout',
  robots: { index: false, follow: false },
};

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string | string[] }>;
}) {
  const { statut } = await searchParams;
  return <AdminFeedbackView initialStatus={parseFeedbackStatus(statut)} />;
}
