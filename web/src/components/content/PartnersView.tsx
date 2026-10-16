import { PageHeader } from '../layout/PageHeader';
import { Container } from '../ui/Container';
import { EmptyState, ErrorState } from '../ui/EmptyState';
import { ExternalLink } from '../ui/ExternalLink';
import { serverApi } from '@/lib/api/server';
import type { PartnerType } from '@/lib/api/types';
import { safe } from '@/lib/safe';

const COPY: Record<PartnerType, { title: string; intro: string; empty: string }> = {
  partner: {
    title: 'Nos partenaires',
    intro:
      'Les organisations qui nous accompagnent pour faire progresser la sécurité privée en Côte d’Ivoire.',
    empty: 'La liste de nos partenaires sera bientôt publiée.',
  },
  client: {
    title: 'Nos clients',
    intro:
      'Ils nous font confiance pour leurs projets de communication, de conseil et de services numériques.',
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
      <Container className="py-section">
        {!partners ? (
          <ErrorState title="Liste indisponible">{error?.message}</ErrorState>
        ) : partners.length === 0 ? (
          <EmptyState title={copy.empty} />
        ) : (
          <ul className="grid grid-cols-1 grid-ruled sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <li key={p.id} className="flex">
                <article className="flex w-full flex-col gap-3 bg-white p-6">
                  {p.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.logo_url}
                      alt={`Logo de ${p.name}`}
                      width={160}
                      height={80}
                      loading="lazy"
                      className="h-16 w-auto max-w-full object-contain object-left"
                    />
                  ) : (
                    <span aria-hidden="true" className="block h-16 w-28 placeholder-hatch" />
                  )}
                  <h2 className="text-xl heading-block">{p.name}</h2>
                  {p.description ? <p className="text-muted">{p.description}</p> : null}
                  {p.website_url ? (
                    <ExternalLink
                      href={p.website_url}
                      className="mt-auto inline-flex min-h-tap items-center font-extrabold"
                    >
                      Visiter le site
                    </ExternalLink>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
