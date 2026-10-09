import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminEstablishmentDetail } from '@/components/admin/etablissements/AdminEstablishmentDetail';

export const metadata: Metadata = { title: 'Fiche établissement' };

export default async function AdminEstablishmentPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  if ((type !== 'provider' && type !== 'state_force') || !/^[1-9]\d{0,9}$/.test(id)) notFound();
  return <AdminEstablishmentDetail type={type} id={Number(id)} />;
}
