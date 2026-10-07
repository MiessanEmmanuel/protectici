import type { Metadata } from 'next';
import { NearbyForces } from '@/components/directory/NearbyForces';
import { ProviderCard } from '@/components/directory/ProviderCard';
import { Container } from '@/components/ui/Container';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Tag';
import { serverApi } from '@/lib/api/server';
import { safe } from '@/lib/safe';

export const metadata: Metadata = {
  title: { absolute: 'ProtectIci — Annuaire de la sécurité privée en Côte d’Ivoire' },
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [[reference, refError], [home, homeError], [forces]] = await Promise.all([
    safe(serverApi.getReferenceData()),
    safe(serverApi.getHome()),
    safe(serverApi.listStateForces({ per_page: 3, sort: 'name' })),
  ]);

  return (
    <>
      <section aria-labelledby="titre-accueil" className="bg-primary-soft">
        <Container className="py-10 sm:py-14">
          <h1 id="titre-accueil" className="max-w-3xl text-3xl font-bold sm:text-4xl">
            Trouvez une entreprise de sécurité de confiance en Côte d’Ivoire
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Comparez les prestataires de sécurité privée, consultez les avis et retrouvez les forces
            étatiques les plus proches de vous.
          </p>
          <form
            action="/annuaire"
            method="get"
            role="search"
            aria-label="Rechercher un prestataire"
            className="mt-6 grid gap-4 rounded-lg bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          >
            <Input
              label="Que recherchez-vous ?"
              name="q"
              type="search"
              maxLength={100}
              placeholder="Nom, gardiennage, alarme…"
            />
            <Select label="Ville" name="city" defaultValue="" disabled={!reference}>
              <option value="">Toutes les villes</option>
              {reference?.cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Type de service" name="service" defaultValue="" disabled={!reference}>
              <option value="">Tous les services</option>
              {reference?.service_types.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button type="submit" size="lg">
              Rechercher
            </Button>
          </form>
          {refError ? (
            <p role="alert" className="mt-3 text-danger">
              Les listes de choix n’ont pas pu être chargées. Vous pouvez tout de même lancer une
              recherche par nom.
            </p>
          ) : null}
          {home ? (
            <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-muted">
              <li>
                <strong className="text-ink">{home.stats.providers}</strong>{' '}
                {home.stats.providers > 1 ? 'prestataires référencés' : 'prestataire référencé'}
              </li>
              <li>
                <strong className="text-ink">{home.stats.state_forces}</strong>{' '}
                {home.stats.state_forces > 1 ? 'structures étatiques' : 'structure étatique'}
              </li>
              <li>
                <strong className="text-ink">{home.stats.service_types}</strong> types de services
              </li>
            </ul>
          ) : null}
        </Container>
      </section>

      <Container as="section" aria-labelledby="titre-populaires" className="py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="titre-populaires" className="text-2xl font-bold">
            Prestataires populaires
          </h2>
          <ButtonLink href="/annuaire" variant="secondary">
            Voir tout l’annuaire
          </ButtonLink>
        </div>
        {homeError ? (
          <div className="mt-4">
            <ErrorState title="Les prestataires n’ont pas pu être chargés">
              {homeError.message}
            </ErrorState>
          </div>
        ) : home && home.popular_providers.length > 0 ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {home.popular_providers.map((p) => (
              <li key={p.slug}>
                <ProviderCard provider={p} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="Aucun prestataire à afficher pour le moment">
              Revenez bientôt ou parcourez l’annuaire.
            </EmptyState>
          </div>
        )}
      </Container>

      <Container as="section" aria-labelledby="titre-forces" className="py-6">
        <h2 id="titre-forces" className="text-2xl font-bold">
          Forces étatiques près de vous
        </h2>
        <p className="mt-1 mb-4 max-w-prose text-muted">
          Police, gendarmerie, sapeurs-pompiers : retrouvez la structure la plus proche et la
          démarche à suivre.
        </p>
        <NearbyForces initial={forces?.data ?? []} />
      </Container>

      <Container as="section" aria-labelledby="titre-inscription" className="py-10">
        <div className="flex flex-col gap-4 rounded-lg bg-accent p-6 text-on-accent sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="titre-inscription" className="text-xl font-bold">
              Vous dirigez une entreprise de sécurité ou une structure étatique ?
            </h2>
            <p className="mt-1 max-w-prose">
              Faites référencer votre établissement et gagnez en visibilité auprès des particuliers
              et des entreprises.{' '}
              <Badge tone="neutral" className="align-middle">
                Bientôt disponible
              </Badge>
            </p>
          </div>
          <ButtonLink
            href="/inscription-etablissement"
            variant="primary"
            size="lg"
            className="shrink-0"
          >
            Inscrire mon établissement
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
