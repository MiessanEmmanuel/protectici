import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminClaimDetail } from '@/components/admin/revendications/AdminClaimDetail';

export const metadata: Metadata = { title: 'Revendication' };

export default async function AdminClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) notFound();
  return <AdminClaimDetail id={Number(id)} />;
}
