import type { Metadata } from 'next';
import { AdminContactMessagesView } from '@/components/admin/messages/AdminContactMessagesView';

export const metadata: Metadata = {
  title: 'Messages de contact',
  robots: { index: false, follow: false },
};

export default function AdminContactMessagesPage() {
  return <AdminContactMessagesView />;
}
