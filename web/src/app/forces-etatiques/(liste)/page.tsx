import type { Metadata } from 'next';
import { DirectoryFilters } from '@/components/directory/DirectoryFilters';
import { ForceCard } from '@/components/directory/ForceCard';
import { CardGrid, NoResults, ResultsCount } from '@/components/directory/ResultsList';
import { ViewToggle } from '@/components/directory/ResultsHeader';
import { PageHeader } from '@/components/layout/PageHeader';
import { DirectoryMap } from '@/components/map/DirectoryMap';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { serverApi } from '@/lib/api/server';
import { safe } from '@/lib/safe';
import {
  buildHref,
  parseForceParams,
  queryToUrlParams,
  type RawSearchParams,
} from '@/lib/search-params';

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { query } = parseForceParams(await searchParams);
  const filtered = Boolean(
    query.q ||
    query.city ||
    query.district ||
    query.type ||
    query.procedure ||
    query.lat !== undefined ||
    query.page,
  );
  return {
    title: 'Forces étatiques : police, gendarmerie, sapeurs-pompiers',
    description:
      'Retrouvez les commissariats, brigades et casernes de Côte d’Ivoire, leurs horaires, leurs numéros d’urgence et les démarches possibles (plainte, perte, constat).',
    alternates: { canonical: '/forces-etatiques' },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function ForcesPage({ searchParams }: Props) {
  const { query, view } = parseForceParams(await searchParams);
  const [[reference, refError], [result, listError]] = await Promise.all([
    safe(serverApi.getReferenceData()),
    safe(serverApi.listStateForces({ ...query, per_page: 12 })),
  ]);

  const urlParams = queryToUrlParams(query, view);
  const hrefFor = (page: number) =>
    buildHref('/forces-etatiques', { ...urlParams, page: page > 1 ? page : undefined });
  const listHref = buildHref('/forces-etatiques', { ...urlParams, view: undefined });
  const mapHref = buildHref('/forces-etatiques', { ...urlParams, view: 'map' });
  const { page: _page, per_page: _perPage, sort: _sort, ...markerFilters } = query;
  void _page;
  void _perPage;
  void _sort;

  return (
    <>
      <PageHeader
        title="Forces étatiques"
        intro="Police, gendarmerie, sapeurs-pompiers, douanes : trouvez la structure la plus proche et la démarche à suivre."
      />
      <Container className="flex flex-col gap-6 py-8">
        {reference ? (
          <DirectoryFilters
            kind="forces"
            reference={reference}
            basePath="/forces-etatiques"
            view={view}
            initial={{
              q: query.q,
              city: query.city,
              district: query.district,
              sort: query.sort,
              lat: query.lat,
              lng: query.lng,
              first: query.type?.[0],
              second: query.procedure?.[0],
            }}
          />
        ) : (
          <ErrorState title="Les filtres n’ont pas pu être chargés">{refError?.message}</ErrorState>
        )}

        {listError ? (
          <ErrorState
            title="La liste n’a pas pu être chargée"
            action={
              <ButtonLink href={buildHref('/forces-etatiques', urlParams)} variant="secondary">
                Réessayer
              </ButtonLink>
            }
          >
            {listError.message}
          </ErrorState>
        ) : result ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ResultsCount total={result.meta.total} noun="structure" nouns="structures" />
              <ViewToggle listHref={listHref} mapHref={mapHref} view={view} />
            </div>
            {view === 'map' ? (
              <DirectoryMap
                query={{ kind: 'state_forces', filters: markerFilters }}
                hrefBase="/forces-etatiques"
                label="Carte des forces étatiques"
              />
            ) : null}
            {result.data.length === 0 ? (
              <NoResults resetHref="/forces-etatiques" />
            ) : (
              <>
                {view === 'map' ? (
                  <h2 className="text-lg font-semibold">Liste des résultats</h2>
                ) : null}
                <CardGrid>
                  {result.data.map((f) => (
                    <li key={f.slug}>
                      <ForceCard force={f} />
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
