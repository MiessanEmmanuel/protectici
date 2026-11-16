import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { FavoriteButton } from '@/components/directory/FavoriteButton';
import { ReviewsList } from '@/components/directory/ReviewsList';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ShareLinks } from '@/components/directory/ShareLinks';
import { ClaimCallout } from '@/components/claims/ClaimCallout';
import { ViewTracker } from '@/components/directory/ViewTracker';
import { MiniMap } from '@/components/map/MiniMap';
import { DirectionsItem } from '@/components/directory/DirectionsLink';
import { BadgeCheck, Mail, MapPin, Phone, Share2, Siren, Star } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ButtonLink, buttonClasses } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { JsonLd } from '@/components/ui/JsonLd';
import { Pagination } from '@/components/ui/Pagination';
import { RatingStars } from '@/components/ui/RatingStars';
import { Badge } from '@/components/ui/Tag';
import { serverApi } from '@/lib/api/server';
import { SITE_URL } from '@/lib/env';
import { formatFcfa, formatPhone, formatRating, pluralize, telHref } from '@/lib/format';
import { legalFormLabel, positionLabel } from '@/lib/labels';
import { safe } from '@/lib/safe';
import { buildHref } from '@/lib/search-params';
import { serviceIcon } from '@/lib/service-icons';

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
            <ButtonLink href="/annuaire" variant="solid">
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
    ['Forme juridique', legalFormLabel(legal.legal_form)],
    ['Capital social', legal.share_capital !== null ? formatFcfa(legal.share_capital) : null],
    ['N° RCCM', legal.rccm],
    ['N° d’agrément', legal.approval_number],
    ['Objet social', legal.corporate_purpose],
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <ViewTracker slug={provider.slug} />

      {/* ---------- En-tête en aplat bleu ---------- */}
      <header className="bg-c1 text-on-c1">
        <div className="wrap py-8 md:py-12 [&_a]:text-inherit">
          <Breadcrumb
            items={[
              { label: 'Accueil', href: '/' },
              { label: 'Prestataires', href: '/annuaire' },
              { label: provider.name },
            ]}
          />
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
            {provider.logo_url ? (
              // <img> et non next/image : next/image injecte un style en ligne bloqué par la CSP.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={provider.logo_url}
                alt=""
                width={120}
                height={120}
                className="size-24 border-2 border-white bg-white object-contain md:size-[120px]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-24 place-items-center bg-c2 text-[2.6rem] font-black text-on-c2 md:size-[120px]"
              >
                {provider.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                {provider.is_verified ? (
                  <Badge tone="accent">
                    <BadgeCheck aria-hidden="true" />
                    Fiche vérifiée
                  </Badge>
                ) : null}
                {provider.is_featured ? <Badge tone="night">À la une</Badge> : null}
              </div>
              <h1 className="text-section heading-block break-words">{provider.name}</h1>
              <p className="mt-3 flex items-center gap-2 text-lg opacity-90 [&_svg]:size-[1.1em]">
                <MapPin aria-hidden="true" />
                {place}
              </p>
            </div>
            {provider.rating_count > 0 ? (
              <p className="md:text-right">
                <span className="flex items-center gap-2 text-[3rem] leading-none font-black md:justify-end">
                  <Star aria-hidden="true" className="size-[0.6em] fill-c2 stroke-c2" />
                  {formatRating(provider.rating_avg)}
                  <span className="sr-only"> sur 5</span>
                </span>
                <span className="text-sm opacity-85">
                  {pluralize(provider.rating_count, 'avis', 'avis')}
                </span>
              </p>
            ) : (
              <p className="text-sm font-semibold opacity-85">Pas encore d’avis</p>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Actions directes ---------- */}
      <div className="border-b-2 border-ink bg-c4 text-on-c4">
        <div className="wrap flex flex-wrap gap-3 py-4">
          <ButtonLink href={telHref(provider.phone)} variant="solid" size="lg">
            <Phone aria-hidden="true" />
            Appeler {formatPhone(provider.phone)}
          </ButtonLink>
          <ButtonLink
            href={`/devis?prestataire=${encodeURIComponent(provider.slug)}`}
            variant="accent"
            size="lg"
          >
            Demander un devis
          </ButtonLink>
          <FavoriteButton
            slug={provider.slug}
            name={provider.name}
            initial={provider.is_favorite}
          />
          <a href="#partager" className={buttonClasses('outline', 'lg')}>
            <Share2 aria-hidden="true" />
            Partager
          </a>
        </div>
      </div>

      <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="presentation">
            <h2 id="presentation" className="text-[2rem] heading-block">
              Présentation
            </h2>
            {/* Description saisie par le prestataire : traitée comme texte brut (échappé par React). */}
            <p className="mt-4 max-w-[70ch] text-lg whitespace-pre-line">{provider.description}</p>
            {provider.price_from ? (
              <p className="mt-5 inline-block bg-c2 px-3 py-2 font-extrabold text-on-c2">
                À partir de {formatFcfa(provider.price_from)}
              </p>
            ) : (
              <p className="mt-5 inline-block border-2 border-ink px-3 py-2 font-bold">
                Tarif communiqué sur devis.
              </p>
            )}
          </section>

          <section aria-labelledby="services">
            <h2 id="services" className="text-[2rem] heading-block">
              Services proposés
            </h2>
            <ul className="mt-5 grid grid-cols-1 grid-ruled sm:grid-cols-2">
              {provider.services.map((s) => {
                const Icon = serviceIcon(s.slug);
                return (
                  <li
                    key={s.slug}
                    className="flex min-h-14 items-center gap-3 px-4 py-3 font-extrabold [&_svg]:size-6 [&_svg]:shrink-0 [&_svg]:text-c1"
                  >
                    <Icon aria-hidden="true" />
                    {s.name}
                  </li>
                );
              })}
            </ul>
            {provider.company_types.length > 0 ? (
              <p className="mt-4 text-ink-2">
                <span className="eyebrow text-ink">Type d’entreprise</span>{' '}
                {provider.company_types.map((t) => t.name).join(', ')}
              </p>
            ) : null}
          </section>

          {provider.branches.length > 0 ? (
            <section aria-labelledby="agences">
              <h2 id="agences" className="text-[2rem] heading-block">
                Agences
              </h2>
              <p className="mt-2 text-ink-2">En plus du siège, indiqué dans les coordonnées.</p>
              <ul className="mt-5 grid grid-cols-1 grid-ruled sm:grid-cols-2">
                {provider.branches.map((b) => (
                  <li key={b.id} className="min-w-0 p-4 break-words">
                    <strong className="block text-lg font-extrabold">{b.label}</strong>
                    <span className="block text-ink-2">
                      {[b.district?.name, b.city.name].filter(Boolean).join(', ')}
                    </span>
                    {b.address ? <span className="mt-2 block">{b.address}</span> : null}
                    {/* Repères saisis par le prestataire : texte brut (échappé par React). */}
                    {b.geo_description ? (
                      <span className="block text-sm text-ink-2">{b.geo_description}</span>
                    ) : null}
                    {b.phone ? (
                      <a
                        href={telHref(b.phone)}
                        aria-label={`Appeler ${b.label} au ${formatPhone(b.phone)}`}
                        className="mt-1 inline-flex min-h-tap items-center gap-2 font-extrabold [&_svg]:size-[1.15em]"
                      >
                        <Phone aria-hidden="true" />
                        {formatPhone(b.phone)}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="legal">
            <h2 id="legal" className="text-[2rem] heading-block">
              Informations légales
            </h2>
            <dl className="mt-5 border-t-2 border-ink">
              {legalRows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="grid gap-1 border-b-2 border-ink py-3 sm:grid-cols-[13rem_1fr] sm:gap-6"
                  >
                    <dt className="pt-1 eyebrow">{k}</dt>
                    <dd className="font-semibold break-words">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>

          {provider.executives.length > 0 ? (
            <section aria-labelledby="dirigeants">
              <h2 id="dirigeants" className="text-[2rem] heading-block">
                Dirigeants
              </h2>
              <ul className="mt-5 grid grid-cols-1 grid-ruled sm:grid-cols-2">
                {provider.executives.map((e) => (
                  <li key={`${e.full_name}-${e.position}`} className="p-4">
                    <strong className="block text-lg font-extrabold">{e.full_name}</strong>
                    <span className="text-ink-2">{positionLabel(e)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="avis" className="scroll-mt-header">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="avis" className="text-[2rem] heading-block">
                Avis des clients
              </h2>
              {provider.rating_count > 0 ? (
                <RatingStars value={provider.rating_avg} count={provider.rating_count} />
              ) : null}
            </div>
            <div className="mt-5">
              {reviews && reviews.data.length > 0 ? (
                <>
                  <ReviewsList reviews={reviews.data} redirectTo={`/annuaire/${provider.slug}`} />
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
                <p className="border-2 border-ink bg-c4 p-5 font-semibold">
                  Aucun avis publié pour le moment.
                </p>
              )}
            </div>
            <div className="mt-8">
              <ReviewForm slug={provider.slug} providerName={provider.name} />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6" aria-label="Coordonnées et partage">
          <section
            aria-labelledby="coordonnees"
            className="bg-c3 p-6 text-on-c3 [&_a]:text-inherit"
          >
            <h2 id="coordonnees" className="text-2xl heading-block">
              Coordonnées
            </h2>
            <ul className="mt-4">
              <li className="border-t-2 border-current">
                <a
                  href={telHref(provider.phone)}
                  className="flex min-h-14 items-center gap-2.5 font-extrabold no-underline hover:underline [&_svg]:size-[1.15em]"
                >
                  <Phone aria-hidden="true" />
                  {formatPhone(provider.phone)}
                </a>
              </li>
              {provider.emergency_phone ? (
                <li className="border-t-2 border-current">
                  <a
                    href={telHref(provider.emergency_phone)}
                    className="flex min-h-14 items-center gap-2.5 font-extrabold no-underline hover:underline [&_svg]:size-[1.15em]"
                  >
                    <Siren aria-hidden="true" />
                    Urgence : {formatPhone(provider.emergency_phone)}
                  </a>
                </li>
              ) : null}
              {provider.email ? (
                <li className="border-t-2 border-current">
                  <a
                    href={`mailto:${provider.email}`}
                    className="flex min-h-14 items-center gap-2.5 font-bold break-all no-underline hover:underline [&_svg]:size-[1.15em] [&_svg]:shrink-0"
                  >
                    <Mail aria-hidden="true" />
                    {provider.email}
                  </a>
                </li>
              ) : null}
              {provider.website_url ? (
                <li className="flex min-h-14 items-center border-t-2 border-current font-bold">
                  <ExternalLink href={provider.website_url}>Site web</ExternalLink>
                </li>
              ) : null}
              {provider.address || provider.geo_description ? (
                <li className="border-t-2 border-current py-3">
                  {provider.address ? <p>{provider.address}</p> : null}
                  {provider.geo_description ? (
                    <p className="text-sm opacity-80">{provider.geo_description}</p>
                  ) : null}
                </li>
              ) : null}
              <DirectionsItem
                name={provider.name}
                lat={provider.lat}
                lng={provider.lng}
                address={provider.address}
                place={place}
              />
            </ul>
            {socials.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t-2 border-current pt-3 text-sm font-bold">
                {socials.map(([key, url]) => (
                  <li key={key} className="flex min-h-tap items-center">
                    <ExternalLink href={url}>{socialLabels[key] ?? key}</ExternalLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          {/* Rien n'est affiché si ni le siège ni les agences ne sont géolocalisés. */}
          <MiniMap
            name={provider.name}
            lat={provider.lat}
            lng={provider.lng}
            address={provider.address}
            branches={provider.branches}
          />
          <div id="partager" className="scroll-mt-header border-2 border-ink p-5">
            <ShareLinks url={pageUrl} title={provider.name} />
          </div>
          <ClaimCallout type="provider" slug={provider.slug} claimable={provider.is_claimable} />
          <div className="flex flex-col gap-3 bg-c2 p-6 text-on-c2">
            <p className="eyebrow">Dis-moi tout</p>
            <p className="text-xl heading-block">Une remarque sur ce prestataire&nbsp;?</p>
            <ButtonLink
              href={buildHref('/dis-moi-tout', { prestataire: provider.slug })}
              variant="solid"
              className="self-start"
            >
              Envoyer un message
            </ButtonLink>
          </div>
        </aside>
      </Container>
    </>
  );
}
