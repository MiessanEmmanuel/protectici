import type { Metadata } from 'next';
import { AdminSettingsView } from '@/components/admin/content/AdminSettingsView';

export const metadata: Metadata = { title: 'Paramètres du site' };

export default function Page() {
  return <AdminSettingsView />;
}
