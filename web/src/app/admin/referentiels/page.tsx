import type { Metadata } from 'next';
import { AdminReferenceView } from '@/components/admin/reference/AdminReferenceView';

export const metadata: Metadata = { title: 'Référentiels' };

export default function AdminReferencePage() {
  return <AdminReferenceView />;
}
