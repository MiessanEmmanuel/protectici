import type { Metadata } from 'next';
import { AdminUsersView } from '@/components/admin/users/AdminUsersView';

export const metadata: Metadata = { title: 'Utilisateurs' };

export default function AdminUsersPage() {
  return <AdminUsersView />;
}
