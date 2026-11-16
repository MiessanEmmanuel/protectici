import type { Metadata } from 'next';
import { AdminEstablishmentsList } from '@/components/admin/etablissements/AdminEstablishmentsList';
import type { EstablishmentStatus, EstablishmentType } from '@/lib/api/types';

export const metadata: Metadata = { title: 'Établissements' };

const TYPES: readonly EstablishmentType[] = ['provider', 'state_force'];
const STATUSES: readonly EstablishmentStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'suspended',
];

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | '' {
  const v = Array.isArray(value) ? value[0] : value;
  return allowed.find((a) => a === v) ?? '';
}

export default async function AdminEstablishmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawImport = Array.isArray(sp.import_id) ? sp.import_id[0] : sp.import_id;
  const rawIncomplete = Array.isArray(sp.incomplete) ? sp.incomplete[0] : sp.incomplete;
  return (
    <AdminEstablishmentsList
      initialType={pick(sp.type, TYPES)}
      initialStatus={pick(sp.status, STATUSES)}
      initialImportId={rawImport && /^[1-9]\d{0,9}$/.test(rawImport) ? Number(rawImport) : null}
      initialIncomplete={rawIncomplete === '1'}
    />
  );
}
