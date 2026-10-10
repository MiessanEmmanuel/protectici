import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { EmptyState } from '@/components/ui/EmptyState';

/** Pages prévues dans les phases suivantes : on les annonce clairement plutôt que d'afficher une 404. */
const PAGES: Record<string, { title: string; phase: string; text: string }> = {
  'a-propos': {
    title: 'Qui sommes-nous',
    phase: 'Phase 4',
    text: 'La présentation de ProtectIci, de sa mission et de ses valeurs sera publiée prochainement.',
  },
  'mentions-legales': {
    title: 'Mentions légales',
    phase: 'Phase 4',
    text: 'Les mentions légales seront publiées avant l’ouverture au public.',
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    phase: 'Phase 4',
    text: 'La politique de confidentialité sera publiée avant l’ouverture au public.',
  },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PAGES).map((page) => ({ page }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  const entry = PAGES[page];
  return entry
    ? { title: `${entry.title} (bientôt disponible)`, robots: { index: false, follow: true } }
    : {};
}

export default async function ComingSoonPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const entry = PAGES[page];
  if (!entry) notFound();
  return (
    <>
      <PageHeader title={entry.title} />
      <Container className="py-10">
        <EmptyState
          title="Bientôt disponible"
          action={
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/annuaire">Parcourir l’annuaire</ButtonLink>
              <ButtonLink href="/" variant="secondary">
                Retour à l’accueil
              </ButtonLink>
            </div>
          }
        >
          <p>{entry.text}</p>
          <p className="mt-2 text-sm">
            Cette page est prévue en {entry.phase.toLowerCase()} du développement.
          </p>
        </EmptyState>
      </Container>
    </>
  );
}
