import type { Metadata } from 'next';
import { AdminChangeRequestsView } from '@/components/admin/modifications/AdminChangeRequestsView';

export const metadata: Metadata = { title: 'Demandes de modification' };

export default function AdminChangeRequestsPage() {
  return <AdminChangeRequestsView />;
}
