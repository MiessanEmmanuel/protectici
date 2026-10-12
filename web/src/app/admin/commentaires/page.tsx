import type { Metadata } from 'next';
import { AdminCommentsView } from '@/components/admin/content/AdminCommentsView';

export const metadata: Metadata = { title: 'Commentaires du blog' };

export default function Page() {
  return <AdminCommentsView />;
}
