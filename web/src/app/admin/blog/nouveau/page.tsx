import type { Metadata } from 'next';
import { PostEditor } from '@/components/admin/content/PostEditor';

export const metadata: Metadata = { title: 'Nouvel article' };

export default function Page() {
  return <PostEditor />;
}
