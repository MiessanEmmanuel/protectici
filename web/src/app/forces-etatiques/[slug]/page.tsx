import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ShareLinks } from '@/components/directory/ShareLinks';
import { MiniMap } from '@/components/map/MiniMap';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { JsonLd } from '@/components/ui/JsonLd';
import { Badge, Tag } from '@/components/ui/Tag';
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
            <ButtonLink href="/forces-etatiques" variant="secondary">
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
    <Container className="py-6">
      <JsonLd data={jsonLd} />
      <Breadcrumb
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Forces étatiques', href: '/forces-etatiques' },
          { label: force.name },
        ]}
      />
      <header className="mt-4">
        <Tag>{force.force_type.name}</Tag>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{force.name}</h1>
        <p className="text-muted">{place}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {force.is_open_24h ? (
            <Badge tone="success">Ouvert 24 h/24</Badge>
          ) : (
            <Badge>Horaires limités</Badge>
          )}
          {force.emergency_phone ? (
            <ButtonLink href={telHref(force.emergency_phone)} variant="danger">
              Urgence : {force.emergency_phone}
            </ButtonLink>
          ) : null}
          {force.phone ? (
            <ButtonLink href={telHref(force.phone)} variant="secondary">
              Appeler {formatPhone(force.phone)}
            </ButtonLink>
          ) : null}
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="presentation">
            <h2 id="presentation" className="text-xl font-bold">
              Présentation
            </h2>
            <p className="mt-2 whitespace-pre-line">{force.description}</p>
          </section>
          <section aria-labelledby="demarches">
            <h2 id="demarches" className="text-xl font-bold">
              Démarches possibles
            </h2>
            {force.procedures.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {force.procedures.map((p) => (
                  <li key={p.slug} className="rounded-md border border-line p-3">
                    <p className="font-semibold">{p.name}</p>
                    {p.notes ? <p className="text-sm text-muted">{p.notes}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted">Aucune démarche renseignée pour cette structure.</p>
            )}
          </section>
          <section aria-labelledby="horaires">
            <h2 id="horaires" className="text-xl font-bold">
              Horaires
            </h2>
            <p className="mt-2">{force.opening_hours ?? 'Horaires non communiqués.'}</p>
          </section>
        </div>
        <aside className="flex flex-col gap-4" aria-label="Coordonnées et partage">
          <Card>
            <h2 className="text-lg font-bold">Coordonnées</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {force.address ? <li>{force.address}</li> : null}
              {force.geo_description ? (
                <li className="text-muted">{force.geo_description}</li>
              ) : null}
              {force.email ? (
                <li>
                  <a href={`mailto:${force.email}`}>{force.email}</a>
                </li>
              ) : null}
            </ul>
          </Card>
          {force.lat !== null && force.lng !== null ? (
            <MiniMap name={force.name} lat={force.lat} lng={force.lng} address={force.address} />
          ) : null}
          <Card>
            <ShareLinks url={pageUrl} title={force.name} />
          </Card>
        </aside>
      </div>
    </Container>
  );
}
