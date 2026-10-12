import type { Metadata } from 'next';
import { AdminCategoriesView } from '@/components/admin/content/AdminCategoriesView';

export const metadata: Metadata = { title: 'Catégories du blog' };

export default function Page() {
  return <AdminCategoriesView />;
}
