import type { Metadata } from 'next';
import { AdminPartnersView } from '@/components/admin/content/AdminPartnersView';

export const metadata: Metadata = { title: 'Partenaires et clients' };

export default function Page() {
  return <AdminPartnersView />;
}
