import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EstablishmentManager } from '@/components/establishment/EstablishmentManager';
import { RequireAuth } from '@/components/establishment/RequireAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { serverApi } from '@/lib/api/server';
import type { EstablishmentType } from '@/lib/api/types';
import { safe } from '@/lib/safe';

type Props = { params: Promise<{ type: string; slug: string }> };

export const metadata: Metadata = {
  title: 'Gérer ma fiche',
  robots: { index: false, follow: false },
};

const TYPES: EstablishmentType[] = ['provider', 'state_force'];

export default async function ManageEstablishmentPage({ params }: Props) {
  const { type, slug } = await params;
  if (!TYPES.includes(type as EstablishmentType)) notFound();
  const [reference] = await safe(serverApi.getReferenceData());
  return (
    <>
      <PageHeader title="Gérer ma fiche">
        <p className="mb-2 text-sm">
          <Link href="/espace-prestataire">← Mes établissements</Link>
        </p>
      </PageHeader>
      <Container className="py-8">
        <RequireAuth
          redirectTo={`/espace-prestataire/${type}/${slug}`}
          intro="Connectez-vous avec une adresse e-mail vérifiée pour gérer cette fiche."
        >
          {reference ? (
            <EstablishmentManager type={type as EstablishmentType} slug={slug} reference={reference} />
          ) : (
            <ErrorState>Les listes de choix sont indisponibles. Réessayez dans quelques instants.</ErrorState>
          )}
        </RequireAuth>
      </Container>
    </>
  );
}
