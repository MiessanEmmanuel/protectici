import { PageHeader } from '../layout/PageHeader';
import { Card } from '../ui/Card';
import { Container } from '../ui/Container';
import { EmptyState, ErrorState } from '../ui/EmptyState';
import { ExternalLink } from '../ui/ExternalLink';
import { serverApi } from '@/lib/api/server';
import type { PartnerType } from '@/lib/api/types';
import { safe } from '@/lib/safe';

const COPY: Record<PartnerType, { title: string; intro: string; empty: string }> = {
  partner: {
    title: 'Nos partenaires',
    intro: 'Les organisations qui nous accompagnent pour faire progresser la sécurité privée en Côte d’Ivoire.',
    empty: 'La liste de nos partenaires sera bientôt publiée.',
  },
  client: {
    title: 'Nos clients',
    intro: 'Ils nous font confiance pour leurs projets de communication, de conseil et de services numériques.',
    empty: 'La liste de nos clients sera bientôt publiée.',
  },
};

export const partnersTitle = (type: PartnerType) => COPY[type].title;

/** Liste publique des partenaires ou des clients (logos et liens fournis par l'API). */
export async function PartnersView({ type }: { type: PartnerType }) {
  const [partners, error] = await safe(serverApi.listPartners(type));
  const copy = COPY[type];
  return (
    <>
      <PageHeader title={copy.title} intro={copy.intro} />
      <Container className="py-8">
        {!partners ? (
          <ErrorState title="Liste indisponible">{error?.message}</ErrorState>
        ) : partners.length === 0 ? (
          <EmptyState title={copy.empty} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <li key={p.id}>
                <Card className="flex h-full flex-col gap-3">
                  {p.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo_url} alt={`Logo de ${p.name}`} width={160} height={80} loading="lazy" className="h-16 w-auto max-w-full object-contain object-left" />
                  ) : null}
                  <h2 className="text-lg font-bold">{p.name}</h2>
                  {p.description ? <p className="text-muted">{p.description}</p> : null}
                  {p.website_url ? (
                    <ExternalLink href={p.website_url} className="mt-auto inline-flex min-h-tap items-center">
                      Visiter le site
                    </ExternalLink>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
