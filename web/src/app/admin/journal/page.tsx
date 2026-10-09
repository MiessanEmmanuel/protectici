import type { Metadata } from 'next';
import { AdminAuditView } from '@/components/admin/audit/AdminAuditView';

export const metadata: Metadata = { title: 'Journal d’audit' };

export default function AdminAuditPage() {
  return <AdminAuditView />;
}
