import type { Metadata } from 'next';
import { QuoteForm } from '@/components/quote/QuoteForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { serverApi } from '@/lib/api/server';
import { safe } from '@/lib/safe';

export const metadata: Metadata = {
  title: 'Demander un devis',
  description:
    'Décrivez votre besoin en sécurité privée : votre demande est transmise aux prestataires de votre choix ou examinée par notre équipe.',
};

const SLUG = /^[a-z0-9-]{1,190}$/;

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ prestataire?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.prestataire) ? params.prestataire[0] : params.prestataire;

  const [reference] = await safe(serverApi.getReferenceData());
  // Un identifiant inconnu ou mal formé est ignoré silencieusement.
  const [provider] = raw && SLUG.test(raw) ? await safe(serverApi.getProvider(raw)) : [null];

  return (
    <>
      <PageHeader
        title="Demander un devis"
        intro="Décrivez votre besoin : votre demande est transmise aux prestataires que vous choisissez, ou examinée par notre équipe qui l’acheminera."
      />
      <Container className="py-8">
        {reference ? (
          <QuoteForm
            reference={reference}
            initialProvider={provider ? { slug: provider.slug, name: provider.name } : null}
          />
        ) : (
          <ErrorState>Les listes de choix sont indisponibles. Réessayez dans quelques instants.</ErrorState>
        )}
      </Container>
    </>
  );
}
