import type { Metadata } from 'next';
import { AdminNewsletterView } from '@/components/admin/content/AdminNewsletterView';

export const metadata: Metadata = { title: 'Newsletter' };

export default function Page() {
  return <AdminNewsletterView />;
}
