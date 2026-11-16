import type { Metadata } from 'next';
import { BlogHeader } from '@/components/content/BlogHeader';
import { PostCardItem } from '@/components/content/PostCardItem';
import { SectionHeader } from '@/components/ui/Section';
import { toneAt, type Tone } from '@/components/ui/tone';
import { PopularPosts } from '@/components/content/PopularPosts';
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
        {/* Articles 2/3 + les plus lus 1/3 */}
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
          <section aria-labelledby="tous-articles">
            <SectionHeader
              id="tous-articles"
              title={q ? `Résultats pour « ${q} »` : 'Tous les articles'}
            />
            {posts ? (
              <PostList result={posts} basePath="/blog" q={q} narrow />
            ) : (
              <ErrorState title="Articles indisponibles">{error?.message}</ErrorState>
            )}
          </section>
          {popular ? <PopularPosts posts={popular.data} /> : null}
        </div>
      </Container>
    </>
  );
}
