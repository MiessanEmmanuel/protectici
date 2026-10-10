import type { Metadata } from 'next';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { serverApi } from '@/lib/api/server';
import { safe } from '@/lib/safe';

export const metadata: Metadata = {
  title: 'Dis-moi tout',
  description:
    'Encouragement, question, plainte ou suggestion : dites-nous tout sur un prestataire de sécurité privée en Côte d’Ivoire.',
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ prestataire?: string | string[] }>;
}) {
  const params = await searchParams;
  const slug = typeof params.prestataire === 'string' ? params.prestataire : '';
  const [reference] = await safe(serverApi.getReferenceData());
  let initialProvider: { slug: string; name: string } | null = null;
  if (slug && slug.length <= 190 && SLUG.test(slug)) {
    const [provider] = await safe(serverApi.getProvider(slug));
    if (provider) initialProvider = { slug: provider.slug, name: provider.name };
  }
  return (
    <>
      <PageHeader
        title="Dis-moi tout"
        intro="Un encouragement, une question, une plainte ou une suggestion ? Racontez-nous votre expérience : votre message est suivi par notre équipe."
      />
      <Container className="py-8">
        {reference ? (
          <FeedbackForm reference={reference} initialProvider={initialProvider} />
        ) : (
          <ErrorState>Le formulaire est momentanément indisponible. Réessayez dans quelques instants.</ErrorState>
        )}
      </Container>
    </>
  );
}
