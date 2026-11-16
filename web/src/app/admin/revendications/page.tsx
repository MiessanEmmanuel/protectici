import type { Metadata } from 'next';
import { AdminClaimsView } from '@/components/admin/revendications/AdminClaimsView';

export const metadata: Metadata = { title: 'Revendications' };

export default function AdminClaimsPage() {
  return <AdminClaimsView />;
}
