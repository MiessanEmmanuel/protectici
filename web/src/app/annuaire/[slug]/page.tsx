import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { FavoriteButton } from '@/components/directory/FavoriteButton';
import { ReviewsList } from '@/components/directory/ReviewsList';
import { ShareLinks } from '@/components/directory/ShareLinks';
import { ViewTracker } from '@/components/directory/ViewTracker';
import { MiniMap } from '@/components/map/MiniMap';
import { Avatar } from '@/components/ui/Avatar';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { JsonLd } from '@/components/ui/JsonLd';
import { Pagination } from '@/components/ui/Pagination';
import { RatingStars } from '@/components/ui/RatingStars';
import { Badge, Tag } from '@/components/ui/Tag';
import { serverApi } from '@/lib/api/server';
import { SITE_URL } from '@/lib/env';
import { formatFcfa, formatPhone, telHref } from '@/lib/format';
import { positionLabel } from '@/lib/labels';
import { safe } from '@/lib/safe';
import { buildHref } from '@/lib/search-params';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ avis?: string | string[] }>;
};

const getProvider = cache((slug: string) => safe(serverApi.getProvider(slug), () => notFound()));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [provider] = await getProvider(slug);
  if (!provider) return { title: 'Prestataire' };
  const place = [provider.district?.name, provider.city.name].filter(Boolean).join(', ');
  const description = provider.description.replace(/\s+/g, ' ').slice(0, 158);
  return {
    title: `${provider.name} — sécurité privée à ${place}`,
    description,
    alternates: { canonical: `/annuaire/${provider.slug}` },
    openGraph: {
      title: provider.name,
      description,
      type: 'website',
      url: `/annuaire/${provider.slug}`,
    },
  };
}

export default async function ProviderPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = (await searchParams).avis;
  const reviewPage = Math.max(
    1,
    Number.parseInt(Array.isArray(raw) ? (raw[0] ?? '1') : (raw ?? '1'), 10) || 1,
  );

  const [[provider, error], [reviews]] = await Promise.all([
    getProvider(slug),
    safe(serverApi.listProviderReviews(slug, reviewPage, 5)),
  ]);

  if (!provider) {
    return (
      <Container className="py-10">
        <ErrorState
          title="Cette fiche n’a pas pu être chargée"
          action={
            <ButtonLink href="/annuaire" variant="secondary">
              Retour à l’annuaire
            </ButtonLink>
          }
        >
          {error?.message}
        </ErrorState>
      </Container>
    );
  }

  const place = [provider.district?.name, provider.city.name].filter(Boolean).join(', ');
  const pageUrl = `${SITE_URL}/annuaire/${provider.slug}`;
  const socials = Object.entries(provider.socials).filter(([, v]) => v) as [string, string][];
  const socialLabels: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'X',
    linkedin: 'LinkedIn',
    whatsapp: 'WhatsApp',
  };

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: provider.name,
    description: provider.description,
    url: pageUrl,
    telephone: provider.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: provider.address ?? undefined,
      addressLocality: provider.district
        ? `${provider.district.name}, ${provider.city.name}`
        : provider.city.name,
      addressCountry: 'CI',
    },
  };
  if (provider.email) jsonLd.email = provider.email;
  if (provider.logo_url) jsonLd.image = provider.logo_url;
  if (provider.lat !== null && provider.lng !== null) {
    jsonLd.geo = { '@type': 'GeoCoordinates', latitude: provider.lat, longitude: provider.lng };
  }
  if (provider.rating_count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: provider.rating_avg,
      reviewCount: provider.rating_count,
    };
  }
  const sameAs = [provider.website_url, ...socials.map(([, v]) => v)].filter(Boolean);
  if (sameAs.length) jsonLd.sameAs = sameAs;

  const legal = provider.legal;
  const legalRows: [string, string | null][] = [
    ['Forme juridique', legal.legal_form],
    ['Capital social', legal.share_capital !== null ? formatFcfa(legal.share_capital) : null],
    ['N° RCCM', legal.rccm],
    ['N° d’agrément', legal.approval_number],
    ['Objet social', legal.corporate_purpose],
  ];

  return (
    <Container className="py-6">
      <JsonLd data={jsonLd} />
      <ViewTracker slug={provider.slug} />
      <Breadcrumb
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Prestataires', href: '/annuaire' },
          { label: provider.name },
        ]}
      />

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar name={provider.name} src={provider.logo_url} className="size-20 text-2xl" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{provider.name}</h1>
          <p className="text-muted">{place}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RatingStars value={provider.rating_avg} count={provider.rating_count} />
            {provider.is_verified ? <Badge tone="success">✓ Vérifié</Badge> : null}
            {provider.is_featured ? <Badge tone="accent">À la une</Badge> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href={telHref(provider.phone)} variant="primary">
              Appeler {formatPhone(provider.phone)}
            </ButtonLink>
            <ButtonLink
              href={`/devis?prestataire=${encodeURIComponent(provider.slug)}`}
              variant="accent"
            >
              Demander un devis
            </ButtonLink>
            <FavoriteButton
              slug={provider.slug}
              name={provider.name}
              initial={provider.is_favorite}
            />
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="presentation">
            <h2 id="presentation" className="text-xl font-bold">
              Présentation
            </h2>
            {/* Description saisie par le prestataire : traitée comme texte brut (échappé par React). */}
            <p className="mt-2 whitespace-pre-line">{provider.description}</p>
            {provider.price_from ? (
              <p className="mt-3 font-semibold">À partir de {formatFcfa(provider.price_from)}</p>
            ) : (
              <p className="mt-3 text-muted">Tarif communiqué sur devis.</p>
            )}
          </section>

          <section aria-labelledby="services">
            <h2 id="services" className="text-xl font-bold">
              Services proposés
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {provider.services.map((s) => (
                <li key={s.slug}>
                  <Tag>{s.name}</Tag>
                </li>
              ))}
            </ul>
            {provider.company_types.length > 0 ? (
              <p className="mt-3 text-sm text-muted">
                Type d’entreprise : {provider.company_types.map((t) => t.name).join(', ')}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="legal">
            <h2 id="legal" className="text-xl font-bold">
              Informations légales
            </h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]">
              {legalRows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-semibold">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
          </section>

          {provider.executives.length > 0 ? (
            <section aria-labelledby="dirigeants">
              <h2 id="dirigeants" className="text-xl font-bold">
                Dirigeants
              </h2>
              <ul className="mt-2 space-y-1">
                {provider.executives.map((e) => (
                  <li key={`${e.full_name}-${e.position}`}>
                    <strong>{e.full_name}</strong> — {positionLabel(e)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="avis">
            <h2 id="avis" className="text-xl font-bold">
              Avis des clients
            </h2>
            {provider.rating_count > 0 ? (
              <div className="mt-1">
                <RatingStars value={provider.rating_avg} count={provider.rating_count} />
              </div>
            ) : null}
            <div className="mt-3">
              {reviews && reviews.data.length > 0 ? (
                <>
                  <ReviewsList reviews={reviews.data} />
                  <Pagination
                    label="Pagination des avis"
                    currentPage={reviews.meta.current_page}
                    lastPage={reviews.meta.last_page}
                    hrefFor={(p) =>
                      `${buildHref(`/annuaire/${provider.slug}`, { avis: p > 1 ? p : undefined })}#avis`
                    }
                  />
                </>
              ) : (
                <p className="text-muted">Aucun avis publié pour le moment.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4" aria-label="Coordonnées et partage">
          <Card>
            <h2 className="text-lg font-bold">Coordonnées</h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li>
                <a href={telHref(provider.phone)} className="font-semibold">
                  {formatPhone(provider.phone)}
                </a>
              </li>
              {provider.emergency_phone ? (
                <li>
                  Urgence :{' '}
                  <a href={telHref(provider.emergency_phone)} className="font-semibold">
                    {formatPhone(provider.emergency_phone)}
                  </a>
                </li>
              ) : null}
              {provider.email ? (
                <li>
                  <a href={`mailto:${provider.email}`}>{provider.email}</a>
                </li>
              ) : null}
              {provider.website_url ? (
                <li>
                  <ExternalLink href={provider.website_url}>Site web</ExternalLink>
                </li>
              ) : null}
              {provider.address ? <li>{provider.address}</li> : null}
              {provider.geo_description ? (
                <li className="text-muted">{provider.geo_description}</li>
              ) : null}
            </ul>
            {socials.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-3 text-sm">
                {socials.map(([key, url]) => (
                  <li key={key}>
                    <ExternalLink href={url}>{socialLabels[key] ?? key}</ExternalLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          {provider.lat !== null && provider.lng !== null ? (
            <MiniMap
              name={provider.name}
              lat={provider.lat}
              lng={provider.lng}
              address={provider.address}
            />
          ) : null}
          <Card>
            <ShareLinks url={pageUrl} title={provider.name} />
          </Card>
          <Card>
            <p className="font-semibold">Une remarque sur ce prestataire ?</p>
            <ButtonLink href="/dis-moi-tout" variant="secondary" className="mt-2">
              Dis-moi tout
            </ButtonLink>
            <p className="mt-2 text-sm text-muted">Formulaire bientôt disponible.</p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
