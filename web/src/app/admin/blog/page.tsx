import type { Metadata } from 'next';
import { AdminPostsView } from '@/components/admin/content/AdminPostsView';

export const metadata: Metadata = { title: 'Articles du blog' };

export default function Page() {
  return <AdminPostsView />;
}
