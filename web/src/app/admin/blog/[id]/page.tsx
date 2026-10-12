import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditPostLoader } from '@/components/admin/content/EditPostLoader';

export const metadata: Metadata = { title: 'Modifier l’article' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  return <EditPostLoader id={Number(id)} />;
}
