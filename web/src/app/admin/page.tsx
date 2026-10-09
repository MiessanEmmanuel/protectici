import type { Metadata } from 'next';
import { AdminDashboardView } from '@/components/admin/AdminDashboardView';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default function AdminPage() {
  return <AdminDashboardView />;
}
