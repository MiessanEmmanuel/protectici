import type { Metadata } from 'next';
import { AdminPagesView } from '@/components/admin/content/AdminPagesView';

export const metadata: Metadata = { title: 'Pages institutionnelles' };

export default function Page() {
  return <AdminPagesView />;
}
