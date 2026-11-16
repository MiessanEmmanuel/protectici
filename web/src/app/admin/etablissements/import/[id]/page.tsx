import type { Metadata } from 'next';
import { IMPORTS_ENABLED } from '@/lib/admin-access';
import { notFound } from 'next/navigation';
import { AdminImportDetail } from '@/components/admin/imports/AdminImportDetail';

export const metadata: Metadata = { title: 'Suivi de l’import' };

export default async function AdminImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // API d'import pas encore livrée (R05) : page masquée.
  if (!IMPORTS_ENABLED) notFound();
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) notFound();
  return <AdminImportDetail id={Number(id)} />;
}
