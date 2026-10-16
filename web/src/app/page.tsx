import type { Metadata } from 'next';
import Link from 'next/link';
import { Ambulance, ArrowRight, Flame, LayoutGrid, Phone, ShieldHalf, Siren } from 'lucide-react';
import { HeroSearch } from '@/components/home/HeroSearch';
import { HomeNearbyForces } from '@/components/home/HomeNearbyForces';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { FicheCard, ficheActionClasses } from '@/components/ui/FicheCard';
import { SectionHeader } from '@/components/ui/Section';
import { TileLink } from '@/components/ui/Tile';
import { toneAt, toneClasses, type Tone } from '@/components/ui/tone';
import { serverApi } from '@/lib/api/server';
import type { Option, PostCard, ProviderSummary } from '@/lib/api/types';
import { heroImage } from '@/lib/env';
import { formatDate, formatRating, pluralize, telHref } from '@/lib/format';
import { safe } from '@/lib/safe';
import { buildHref } from '@/lib/search-params';
import { FEATURED_SERVICE_PATTERNS, serviceIcon } from '@/lib/service-icons';

export const metadata: Metadata = {
  title: { absolute: 'ProtectIci — Annuaire de la sécurité privée en Côte d’Ivoire' },
  alternates: { canonical: '/' },
};

/** Numéros d'urgence affichés dans le hero : À CONFIRMER avant la mise en ligne. */
const EMERGENCY = [
  { label: 'Police secours', number: '110', icon: ShieldHalf },
  { label: 'Sapeurs-pompiers', number: '180', icon: Flame },
  { label: 'SAMU', number: '185', icon: Ambulance },
];

const FEEDBACK_KINDS = ['Encouragement', 'Question', 'Plainte', 'Suggestion'];

const METHOD: { tone: Tone; title: string; text: string }[] = [
  {
    tone: 't3',
    title: 'Inscription',
    text: 'L’établissement transmet son RCCM, son agrément et ses coordonnées.',
  },
  {
    tone: 't1',
    title: 'Vérification',
    text: 'Notre équipe contrôle chaque pièce avant toute publication.',
  },
  {
    tone: 't2',
    title: 'Publication',
    text: 'La fiche est publiée une fois vérifiée. Les avis sont modérés.',
  },
];

const PRO_BENEFITS = [
  'Inscription gratuite',
  'Fiche vérifiée avant publication',
  'Demandes de devis reçues directement',
  'Réponse aux avis clients',
];

const MOSAIC_TONES: Tone[] = ['t1', 't2', 't4', 't3', 't5', 't2', 't1'];
const NEWS_TONES: Tone[] = ['t1', 't2', 't3'];

/** Service avec compteur facultatif (l'API ne fournit pas encore de compteur par service). */
type ServiceWithCount = Option & { providers_count?: number | null };

function pickFeatured(services: ServiceWithCount[], max: number): ServiceWithCount[] {
  const picked: ServiceWithCount[] = [];
  for (const re of FEATURED_SERVICE_PATTERNS) {
    const s = services.find((x) => re.test(x.slug) && !picked.includes(x));
    if (s) picked.push(s);
  }
  for (const s of services) if (picked.length < max && !picked.includes(s)) picked.push(s);
  return picked.slice(0, max);
}

function providerMeta(p: ProviderSummary): string {
  const place = p.district ? `${p.city.name}, ${p.district.name}` : p.city.name;
  const services = p.services
    .slice(0, 2)
    .map((s) => s.name)
    .join(', ');
  return services ? `${place} · ${services}` : place;
}

export default async function HomePage() {
  const [[reference], [home], [forces], [posts]] = await Promise.all([
    safe(serverApi.getReferenceData()),
    safe(serverApi.getHome()),
    safe(serverApi.listStateForces({ per_page: 4, sort: 'name' })),
    safe(serverApi.listPosts({ per_page: 3, sort: 'recent' })),
  ]);

  const hero = heroImage();
  const services = (reference?.service_types ?? []) as ServiceWithCount[];
  const featured = pickFeatured(services, 7);
  const others = Math.max(services.length - featured.length, 0);
  const popular = (home?.popular_providers ?? []).slice(0, 4);
  const procedures = (reference?.procedure_types ?? []).slice(0, 5);
  const latest: PostCard[] = posts?.data ?? [];

  return (
    <>
      {/* ---------- Hero 2/3 – 1/3 ---------- */}
      <section
        aria-labelledby="titre-accueil"
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <div className="relative overflow-hidden bg-c1">
          {hero ? (
            <figure className="absolute inset-0 m-0 after:absolute after:inset-0 after:bg-c1 after:opacity-80 after:content-['']">
              {/* <img> et non next/image : next/image injecte un style en ligne bloqué par la CSP stricte. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.url}
                alt=""
                width={1800}
                height={1166}
                fetchPriority="high"
                className="block size-full object-cover object-[20%_50%] lg:object-[30%_55%]"
              />
              {hero.credit ? (
                <figcaption className="absolute right-0 bottom-0 z-[1] bg-c3 px-2.5 py-1 text-[0.68rem] font-semibold text-on-c3">
                  {hero.credit}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
          <div className="relative z-[1] px-4 py-12 text-on-c1 lg:py-16 lg:pr-14 lg:pl-[max(1rem,calc((100vw-75rem)/2))]">
            <Eyebrow>
              {home
                ? `${pluralize(home.stats.providers, 'établissement vérifié', 'établissements vérifiés')} en Côte d’Ivoire`
                : 'Annuaire de la sécurité privée en Côte d’Ivoire'}
            </Eyebrow>
            <h1 id="titre-accueil" className="mt-4 mb-[22px] max-w-[12ch] text-hero heading-block">
              La sécurité, entre de bonnes mains.
            </h1>
            <p className="max-w-[44ch] text-lg opacity-92">
              Trouvez une entreprise de sécurité agréée, un centre de formation ou la force de
              l’ordre la plus proche. Chaque fiche est contrôlée avant publication.
            </p>
            <HeroSearch
              services={services.map((s) => ({ name: s.name, slug: s.slug }))}
              cities={(reference?.cities ?? []).map((c) => ({ name: c.name, slug: c.slug }))}
              providerNames={popular.map((p) => p.name)}
            />
            {featured.length > 0 ? (
              <ul aria-label="Recherches fréquentes" className="mt-2 flex flex-wrap gap-2">
                {featured.slice(0, 4).map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={buildHref('/annuaire', { service: s.slug })}
                      className="inline-flex min-h-tap items-center border-2 border-current px-3.5 text-[0.85rem] font-bold text-inherit no-underline hover:bg-on-c1 hover:text-c1"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="grid grid-rows-[auto_1fr]">
          <div id="urgence" className="scroll-mt-header bg-c2 px-8 py-[34px] text-on-c2">
            <h2 className="flex items-center gap-3 text-2xl heading-block [&_svg]:size-[1.1em]">
              <Siren aria-hidden="true" />
              Urgence
            </h2>
            <ul className="mt-[18px]">
              {EMERGENCY.map(({ label, number, icon: Icon }) => (
                <li key={number} className="border-t-2 border-current">
                  <a
                    href={`tel:${number}`}
                    className="group flex min-h-14 w-full items-center justify-between leading-tight font-bold text-inherit no-underline"
                  >
                    <span className="inline-flex items-center gap-2.5 [&_svg]:size-[1.15em]">
                      <Icon aria-hidden="true" />
                      {label}
                    </span>
                    <b className="text-figure leading-none font-black group-hover:underline">
                      {number}
                    </b>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[0.72rem] font-semibold">
              Numéros à confirmer avant la mise en ligne.
            </p>
          </div>
          <div className="flex flex-col gap-3.5 bg-c3 px-8 py-[34px] text-on-c3">
            <Eyebrow>Dis-moi tout</Eyebrow>
            <h2 className="text-2xl heading-block">Une prestation à signaler&nbsp;?</h2>
            <p className="opacity-85">
              Chaque message reçoit un numéro de suivi et une réponse de notre équipe.
            </p>
            <ul aria-label="Types de messages" className="flex flex-wrap gap-1.5">
              {FEEDBACK_KINDS.map((k) => (
                <li
                  key={k}
                  className="border-2 border-current px-2 py-0.5 text-[0.78rem] font-bold"
                >
                  {k}
                </li>
              ))}
            </ul>
            <ButtonLink
              href="/dis-moi-tout"
              variant="light"
              size="lg"
              className="mt-auto self-start"
            >
              Envoyer un message
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ---------- Mosaïque des services ---------- */}
      {featured.length > 0 ? (
        <section aria-labelledby="titre-services" className="wrap py-section">
          <SectionHeader
            id="titre-services"
            title={<>Que recherchez-vous&nbsp;?</>}
            more={{ href: '/annuaire', label: `Les ${services.length} services` }}
          />
          <ul className="grid grid-cols-2 grid-ruled md:grid-cols-4">
            {featured.map((s, i) => {
              const Icon = serviceIcon(s.slug);
              const n = s.providers_count;
              return (
                <li key={s.slug} className="flex">
                  <TileLink
                    href={buildHref('/annuaire', { service: s.slug })}
                    tone={toneAt(MOSAIC_TONES, i)}
                    figure={
                      typeof n === 'number'
                        ? { value: n, unit: n > 1 ? 'établissements' : 'établissement' }
                        : undefined
                    }
                    label={s.name}
                    icon={<Icon />}
                    className="w-full"
                  />
                </li>
              );
            })}
            {others > 0 ? (
              <li className="flex">
                <TileLink
                  href="/annuaire"
                  tone="t3"
                  figure={{
                    value: `+${others}`,
                    unit: others > 1 ? 'autres services' : 'autre service',
                  }}
                  label={`Voir les ${services.length} services`}
                  icon={<LayoutGrid />}
                  className="w-full"
                />
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {/* ---------- Les plus consultés 2/3 + forces proches 1/3 ---------- */}
      <section aria-labelledby="titre-populaires" className="bg-c4 text-on-c4">
        <div className="wrap grid grid-cols-1 gap-10 py-section lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <SectionHeader
              id="titre-populaires"
              title="Les plus consultés"
              more={{ href: '/annuaire', label: 'Tout l’annuaire' }}
            />
            {popular.length > 0 ? (
              <ul>
                {popular.map((p) => (
                  <li key={p.slug} className="-mb-0.5">
                    <FicheCard
                      href={`/annuaire/${p.slug}`}
                      title={p.name}
                      logoUrl={p.logo_url}
                      meta={providerMeta(p)}
                      verified={p.is_verified ? 'Fiche vérifiée' : null}
                      rating={
                        p.rating_count > 0
                          ? { value: formatRating(p.rating_avg), count: `${p.rating_count} avis` }
                          : null
                      }
                      actions={
                        <>
                          {p.phone ? (
                            <a href={telHref(p.phone)} className={ficheActionClasses}>
                              <Phone aria-hidden="true" />
                              Appeler<span className="sr-only"> {p.name}</span>
                            </a>
                          ) : null}
                          <Link
                            href={buildHref('/devis', { prestataire: p.slug })}
                            className={ficheActionClasses}
                          >
                            Demander un devis<span className="sr-only"> à {p.name}</span>
                          </Link>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-2 border-ink bg-white p-5">
                Aucun prestataire à afficher pour le moment.{' '}
                <Link href="/annuaire">Parcourir l’annuaire</Link>
              </p>
            )}
          </div>
          <HomeNearbyForces initial={forces?.data ?? []} />
        </div>
      </section>

      {/* ---------- Méthode en 3 aplats ---------- */}
      <section aria-labelledby="titre-methode">
        <h2 id="titre-methode" className="sr-only">
          Notre méthode
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-3">
          {METHOD.map((m, i) => (
            <li
              key={m.title}
              className={`${toneClasses[m.tone]} flex flex-col gap-3 px-[30px] py-[34px] md:min-h-[280px]`}
            >
              <span aria-hidden="true" className="text-[5rem] leading-[0.85] font-black">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-[1.5rem] heading-block">{m.title}</h3>
              <p className="opacity-88">{m.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Démarches ---------- */}
      <section aria-labelledby="titre-demarches" className="wrap py-section">
        <SectionHeader
          id="titre-demarches"
          title={<>Une démarche auprès de l’État&nbsp;?</>}
          more={{ href: '/forces-etatiques', label: 'Toutes les structures' }}
        />
        <ul className="grid grid-cols-1 grid-ruled md:grid-cols-3">
          {procedures.map((p) => (
            <li key={p.slug} className="flex">
              <Link
                href={buildHref('/forces-etatiques', { procedure: p.slug })}
                className="group flex w-full items-center justify-between gap-4 p-[22px] text-[1.1rem] font-extrabold text-inherit no-underline hover:bg-c2 hover:text-on-c2"
              >
                {p.name}
                <ArrowRight
                  aria-hidden="true"
                  className="size-[1.1em] shrink-0 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
          <li className="flex">
            <Link
              href={buildHref('/forces-etatiques', { view: 'map' })}
              className="group flex w-full items-center justify-between gap-4 p-[22px] text-[1.1rem] font-extrabold text-inherit no-underline hover:bg-c2 hover:text-on-c2"
            >
              <span>
                La structure la plus proche
                <small className="mt-1 block text-[0.82rem] font-medium text-ink-2 group-hover:text-inherit">
                  Recherche par position
                </small>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="size-[1.1em] shrink-0 transition-transform group-hover:translate-x-1"
              />
            </Link>
          </li>
        </ul>
      </section>

      {/* ---------- Actualités ---------- */}
      {latest.length > 0 ? (
        <section aria-labelledby="titre-actualites" className="wrap pb-section">
          <SectionHeader
            id="titre-actualites"
            title="Actualités"
            more={{ href: '/blog', label: 'Tous les articles' }}
          />
          <ul className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr_1fr]">
            {latest.map((post, i) => (
              <li key={post.slug} className="flex">
                <NewsCard post={post} big={i === 0} tone={toneAt(NEWS_TONES, i)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------- Appel aux professionnels ---------- */}
      <section aria-labelledby="titre-pro" className="bg-c2 text-on-c2">
        <div className="wrap grid grid-cols-1 items-center gap-10 py-16 md:grid-cols-[3fr_2fr]">
          <div>
            <Eyebrow>Professionnels de la sécurité</Eyebrow>
            <h2 id="titre-pro" className="mt-3.5 text-display heading-block">
              Votre entreprise mérite d’être trouvée.
            </h2>
            <div className="mt-[26px] flex flex-wrap gap-3.5">
              <ButtonLink href="/inscription-etablissement" variant="solid" size="lg">
                Inscrire mon établissement
                <ArrowRight aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>
          <ul className="font-bold">
            {PRO_BENEFITS.map((b) => (
              <li key={b} className="border-t-2 border-current py-2.5">
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

/** Carte d'actualité : bande de catégorie en aplat, image 16:10 (16:9 à la une) ou hachures. */
function NewsCard({ post, big, tone }: { post: PostCard; big: boolean; tone: Tone }) {
  const ratio = big ? 'aspect-video' : 'aspect-[16/10]';
  return (
    <article className="group flex w-full flex-col border-2 border-ink">
      <p className={`px-3.5 py-2 eyebrow tracking-[0.1em] ${toneClasses[tone]}`}>
        {post.category.name}
      </p>
      <div className="overflow-hidden bg-c4">
        {post.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover_url}
            alt={post.cover_alt ?? ''}
            width={big ? 1200 : 700}
            height={big ? 675 : 437}
            loading="lazy"
            className={`block h-auto w-full object-cover transition-transform duration-400 group-hover:scale-[1.04] motion-reduce:group-hover:scale-100 ${ratio}`}
          />
        ) : (
          <div aria-hidden="true" className={`placeholder-hatch ${ratio}`} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-[18px]">
        <h3 className={`leading-tight font-extrabold ${big ? 'text-[2rem]' : 'text-[1.3rem]'}`}>
          <Link href={`/blog/${post.slug}`} className="text-inherit no-underline hover:underline">
            {post.title}
          </Link>
        </h3>
        {big && post.excerpt ? <p>{post.excerpt}</p> : null}
        <p className="mt-auto text-[0.8rem] text-ink-2">
          <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          {post.reading_minutes ? ` · ${post.reading_minutes} min` : null}
        </p>
      </div>
    </article>
  );
}
