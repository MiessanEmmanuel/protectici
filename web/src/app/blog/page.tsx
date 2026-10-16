import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogHeader } from '@/components/content/BlogHeader';
import { PostCardItem } from '@/components/content/PostCardItem';
import { SectionHeader } from '@/components/ui/Section';
import { toneAt, type Tone } from '@/components/ui/tone';
import { PostList } from '@/components/content/PostList';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { serverApi } from '@/lib/api/server';
import { parseBlogParams } from '@/lib/blog-params';
import { safe } from '@/lib/safe';
import type { RawSearchParams } from '@/lib/search-params';

const FEATURED_TONES: Tone[] = ['t1', 't2', 't3'];

export const metadata: Metadata = {
  title: 'Blog et actualités',
  description:
    'Actualités, conseils et guides sur la sécurité privée, la prévention incendie, la cybercriminalité et la formation en Côte d’Ivoire.',
  alternates: { canonical: '/blog' },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { query, q, page } = parseBlogParams(await searchParams);
  const showHighlights = page === 1 && !q;
  const [[categories], [posts, error], [featured], [popular]] = await Promise.all([
    safe(serverApi.listBlogCategories()),
    safe(serverApi.listPosts(query)),
    showHighlights
      ? safe(serverApi.listPosts({ featured: true, per_page: 3, sort: 'recent' }))
      : Promise.resolve([null, null] as const),
    showHighlights
      ? safe(serverApi.listPosts({ per_page: 5, sort: 'popular' }))
      : Promise.resolve([null, null] as const),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Blog"
        title="Blog et actualités"
        intro="Conseils, guides et actualités pour mieux protéger vos biens et vos équipes."
      />
      <div className="border-b-2 border-ink bg-c4 text-on-c4">
        <div className="wrap py-8">
          <BlogHeader categories={categories ?? []} q={q} />
        </div>
      </div>
      <Container className="flex flex-col gap-16 py-section">
        {featured && featured.data.length > 0 ? (
          <section aria-labelledby="a-la-une">
            <SectionHeader id="a-la-une" title="À la une" />
            <ul className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr_1fr]">
              {featured.data.map((p, i) => (
                <li key={p.slug} className="flex">
                  <PostCardItem post={p} big={i === 0} tone={toneAt(FEATURED_TONES, i)} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="tous-articles">
          <SectionHeader
            id="tous-articles"
            title={q ? `Résultats pour « ${q} »` : 'Tous les articles'}
          />
          {posts ? (
            <PostList result={posts} basePath="/blog" q={q} />
          ) : (
            <ErrorState title="Articles indisponibles">{error?.message}</ErrorState>
          )}
        </section>
        {popular && popular.data.length > 0 ? (
          <section aria-labelledby="populaires" className="bg-c3 p-6 text-on-c3 md:p-10">
            <h2 id="populaires" className="text-section heading-block">
              Les plus lus
            </h2>
            <ol className="mt-6">
              {popular.data.map((p, i) => (
                <li key={p.slug} className="border-t-2 border-current">
                  <Link
                    href={`/blog/${p.slug}`}
                    className="flex min-h-14 items-center gap-5 py-3 text-lg font-extrabold text-inherit no-underline hover:underline"
                  >
                    <span
                      aria-hidden="true"
                      className="text-figure leading-none font-black text-c2"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </Container>
    </>
  );
}
