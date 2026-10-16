import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ShareLinks } from '@/components/directory/ShareLinks';
import { MiniMap } from '@/components/map/MiniMap';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ButtonLink } from '@/components/ui/Button';
import { Mail, MapPin, Phone, Siren } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { JsonLd } from '@/components/ui/JsonLd';
import { Badge } from '@/components/ui/Tag';
import { serverApi } from '@/lib/api/server';
import { SITE_URL } from '@/lib/env';
import { formatPhone, telHref } from '@/lib/format';
import { safe } from '@/lib/safe';

type Props = { params: Promise<{ slug: string }> };

const getForce = cache((slug: string) => safe(serverApi.getStateForce(slug), () => notFound()));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [force] = await getForce(slug);
  if (!force) return { title: 'Force étatique' };
  const place = [force.district?.name, force.city.name].filter(Boolean).join(', ');
  return {
    title: `${force.name} — ${force.force_type.name} à ${place}`,
    description: force.description.replace(/\s+/g, ' ').slice(0, 158),
    alternates: { canonical: `/forces-etatiques/${force.slug}` },
  };
}

export default async function ForcePage({ params }: Props) {
  const { slug } = await params;
  const [force, error] = await getForce(slug);

  if (!force) {
    return (
      <Container className="py-10">
        <ErrorState
          title="Cette fiche n’a pas pu être chargée"
          action={
            <ButtonLink href="/forces-etatiques" variant="solid">
              Retour à la liste
            </ButtonLink>
          }
        >
          {error?.message}
        </ErrorState>
      </Container>
    );
  }

  const place = [force.district?.name, force.city.name].filter(Boolean).join(', ');
  const pageUrl = `${SITE_URL}/forces-etatiques/${force.slug}`;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOffice',
    name: force.name,
    description: force.description,
    url: pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: force.address ?? undefined,
      addressLocality: place,
      addressCountry: 'CI',
    },
  };
  if (force.phone) jsonLd.telephone = force.phone;
  if (force.lat !== null && force.lng !== null)
    jsonLd.geo = { '@type': 'GeoCoordinates', latitude: force.lat, longitude: force.lng };
  if (force.opening_hours)
    jsonLd.openingHours = force.is_open_24h ? 'Mo-Su 00:00-24:00' : undefined;

  return (
    <>
      <JsonLd data={jsonLd} />
      <header className="bg-c1 text-on-c1">
        <div className="wrap py-8 md:py-12 [&_a]:text-inherit">
          <Breadcrumb
            items={[
              { label: 'Accueil', href: '/' },
              { label: 'Forces étatiques', href: '/forces-etatiques' },
              { label: force.name },
            ]}
          />
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="accent">{force.force_type.name}</Badge>
            {force.is_open_24h ? (
              <Badge tone="night">Ouvert 24 h/24</Badge>
            ) : (
              <Badge tone="neutral">Horaires limités</Badge>
            )}
          </div>
          <h1 className="mt-4 max-w-[22ch] text-section heading-block break-words">{force.name}</h1>
          <p className="mt-3 flex items-center gap-2 text-lg opacity-90 [&_svg]:size-[1.1em]">
            <MapPin aria-hidden="true" />
            {place}
          </p>
        </div>
      </header>

      {force.emergency_phone || force.phone ? (
        <div className="border-b-2 border-ink bg-c2 text-on-c2">
          <div className="wrap flex flex-wrap gap-3 py-4">
            {force.emergency_phone ? (
              <ButtonLink href={telHref(force.emergency_phone)} variant="solid" size="lg">
                <Siren aria-hidden="true" />
                Urgence : {force.emergency_phone}
              </ButtonLink>
            ) : null}
            {force.phone ? (
              <ButtonLink href={telHref(force.phone)} variant="outline" size="lg">
                <Phone aria-hidden="true" />
                Appeler {formatPhone(force.phone)}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      ) : null}

      <Container className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="presentation">
            <h2 id="presentation" className="text-[2rem] heading-block">
              Présentation
            </h2>
            <p className="mt-4 max-w-[70ch] text-lg whitespace-pre-line">{force.description}</p>
          </section>
          <section aria-labelledby="demarches">
            <h2 id="demarches" className="text-[2rem] heading-block">
              Démarches possibles
            </h2>
            {force.procedures.length > 0 ? (
              <ul className="mt-5 grid grid-cols-1 grid-ruled sm:grid-cols-2">
                {force.procedures.map((p) => (
                  <li key={p.slug} className="p-5">
                    <p className="text-lg font-extrabold">{p.name}</p>
                    {p.notes ? <p className="mt-1 text-ink-2">{p.notes}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 border-2 border-ink bg-c4 p-5 font-semibold">
                Aucune démarche renseignée pour cette structure.
              </p>
            )}
          </section>
          <section aria-labelledby="horaires">
            <h2 id="horaires" className="text-[2rem] heading-block">
              Horaires
            </h2>
            <p className="mt-4 border-l-4 border-c1 bg-c4 p-4 text-lg font-semibold whitespace-pre-line">
              {force.opening_hours ?? 'Horaires non communiqués.'}
            </p>
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
              {force.address ? (
                <li className="border-t-2 border-current py-3">{force.address}</li>
              ) : null}
              {force.geo_description ? (
                <li className="border-t-2 border-current py-3 text-sm opacity-80">
                  {force.geo_description}
                </li>
              ) : null}
              {force.email ? (
                <li className="border-t-2 border-current">
                  <a
                    href={`mailto:${force.email}`}
                    className="flex min-h-14 items-center gap-2.5 font-bold break-all no-underline hover:underline [&_svg]:size-[1.15em] [&_svg]:shrink-0"
                  >
                    <Mail aria-hidden="true" />
                    {force.email}
                  </a>
                </li>
              ) : null}
              {!force.address && !force.geo_description && !force.email ? (
                <li className="border-t-2 border-current py-3">Coordonnées non communiquées.</li>
              ) : null}
            </ul>
          </section>
          {force.lat !== null && force.lng !== null ? (
            <MiniMap name={force.name} lat={force.lat} lng={force.lng} address={force.address} />
          ) : null}
          <div className="border-2 border-ink p-5">
            <ShareLinks url={pageUrl} title={force.name} />
          </div>
        </aside>
      </Container>
    </>
  );
}
