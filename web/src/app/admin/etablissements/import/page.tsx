import type { Metadata } from 'next';
import { IMPORTS_ENABLED } from '@/lib/admin-access';
import { notFound } from 'next/navigation';
import { AdminImportStart } from '@/components/admin/imports/AdminImportStart';

export const metadata: Metadata = { title: 'Import Excel' };

export default function AdminImportPage() {
  // API d'import pas encore livrée (R05) : page masquée.
  if (!IMPORTS_ENABLED) notFound();
  return <AdminImportStart />;
}
