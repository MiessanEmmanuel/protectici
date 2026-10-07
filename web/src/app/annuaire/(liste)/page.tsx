import type { Metadata } from 'next';
import { DirectoryFilters } from '@/components/directory/DirectoryFilters';
import { ProviderCard } from '@/components/directory/ProviderCard';
import { CardGrid, NoResults, ResultsCount } from '@/components/directory/ResultsList';
import { ViewToggle } from '@/components/directory/ResultsHeader';
import { PageHeader } from '@/components/layout/PageHeader';
import { DirectoryMap } from '@/components/map/DirectoryMap';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { serverApi } from '@/lib/api/server';
import {
  buildHref,
  parseProviderParams,
  queryToUrlParams,
  type RawSearchParams,
} from '@/lib/search-params';
import { safe } from '@/lib/safe';

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { query } = parseProviderParams(await searchParams);
  const filtered = Boolean(
    query.q ||
    query.city ||
    query.district ||
    query.service ||
    query.company_type ||
    query.lat !== undefined ||
    query.page,
  );
  return {
    title: 'Annuaire des prestataires de sécurité privée',
    description:
      'Recherchez parmi les entreprises de sécurité privée de Côte d’Ivoire par ville, quartier, type de service ou nom, et comparez les avis.',
    alternates: { canonical: '/annuaire' },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function AnnuairePage({ searchParams }: Props) {
  const { query, view } = parseProviderParams(await searchParams);
  const [[reference, refError], [result, listError]] = await Promise.all([
    safe(serverApi.getReferenceData()),
    safe(serverApi.listProviders({ ...query, per_page: 12 })),
  ]);

  const urlParams = queryToUrlParams(query, view);
  const hrefFor = (page: number) =>
    buildHref('/annuaire', { ...urlParams, page: page > 1 ? page : undefined });
  const listHref = buildHref('/annuaire', { ...urlParams, view: undefined });
  const mapHref = buildHref('/annuaire', { ...urlParams, view: 'map' });
  const { page: _page, per_page: _perPage, sort: _sort, ...markerFilters } = query;
  void _page;
  void _perPage;
  void _sort;

  return (
    <>
      <PageHeader
        title="Annuaire des prestataires de sécurité"
        intro="Entreprises de gardiennage, vidéosurveillance, alarmes, escorte, formation… Filtrez par ville, service ou nom."
      />
      <Container className="flex flex-col gap-6 py-8">
        {reference ? (
          <DirectoryFilters
            kind="providers"
            reference={reference}
            basePath="/annuaire"
            view={view}
            initial={{
              q: query.q,
              city: query.city,
              district: query.district,
              sort: query.sort,
              lat: query.lat,
              lng: query.lng,
              first: query.service?.[0],
              second: query.company_type?.[0],
            }}
          />
        ) : (
          <ErrorState title="Les filtres n’ont pas pu être chargés">{refError?.message}</ErrorState>
        )}

        {listError ? (
          <ErrorState
            title="La liste n’a pas pu être chargée"
            action={
              <ButtonLink href={buildHref('/annuaire', urlParams)} variant="secondary">
                Réessayer
              </ButtonLink>
            }
          >
            {listError.message}
          </ErrorState>
        ) : result ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ResultsCount total={result.meta.total} noun="prestataire" nouns="prestataires" />
              <ViewToggle listHref={listHref} mapHref={mapHref} view={view} />
            </div>
            {view === 'map' ? (
              <DirectoryMap
                query={{ kind: 'providers', filters: markerFilters }}
                hrefBase="/annuaire"
                label="Carte des prestataires"
              />
            ) : null}
            {result.data.length === 0 ? (
              <NoResults resetHref="/annuaire" />
            ) : (
              <>
                {view === 'map' ? (
                  <h2 className="text-lg font-semibold">Liste des résultats</h2>
                ) : null}
                <CardGrid>
                  {result.data.map((p) => (
                    <li key={p.slug}>
                      <ProviderCard provider={p} />
                    </li>
                  ))}
                </CardGrid>
                <Pagination
                  currentPage={result.meta.current_page}
                  lastPage={result.meta.last_page}
                  hrefFor={hrefFor}
                />
              </>
            )}
          </>
        ) : null}
      </Container>
    </>
  );
}
