import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogHeader } from '@/components/content/BlogHeader';
import { PostCardItem } from '@/components/content/PostCardItem';
import { PostList } from '@/components/content/PostList';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { serverApi } from '@/lib/api/server';
import { parseBlogParams } from '@/lib/blog-params';
import { safe } from '@/lib/safe';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Blog et actualités',
  description:
    'Actualités, conseils et guides sur la sécurité privée, la prévention incendie, la cybercriminalité et la formation en Côte d’Ivoire.',
  alternates: { canonical: '/blog' },
};

export default async function BlogPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { query, q, page } = parseBlogParams(await searchParams);
  const showHighlights = page === 1 && !q;
  const [[categories], [posts, error], [featured], [popular]] = await Promise.all([
    safe(serverApi.listBlogCategories()),
    safe(serverApi.listPosts(query)),
    showHighlights ? safe(serverApi.listPosts({ featured: true, per_page: 3, sort: 'recent' })) : Promise.resolve([null, null] as const),
    showHighlights ? safe(serverApi.listPosts({ per_page: 5, sort: 'popular' })) : Promise.resolve([null, null] as const),
  ]);

  return (
    <>
      <PageHeader
        title="Blog et actualités"
        intro="Conseils, guides et actualités pour mieux protéger vos biens et vos équipes."
      />
      <Container className="flex flex-col gap-10 py-8">
        <BlogHeader categories={categories ?? []} q={q} />
        {featured && featured.data.length > 0 ? (
          <section aria-labelledby="a-la-une" className="flex flex-col gap-4">
            <h2 id="a-la-une" className="text-2xl font-bold">À la une</h2>
            <ul className="grid gap-4 md:grid-cols-3">
              {featured.data.map((p) => (
                <li key={p.slug}><PostCardItem post={p} /></li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="tous-articles" className="flex flex-col gap-4">
          <h2 id="tous-articles" className="text-2xl font-bold">
            {q ? `Résultats pour « ${q} »` : 'Tous les articles'}
          </h2>
          {posts ? (
            <PostList result={posts} basePath="/blog" q={q} />
          ) : (
            <ErrorState title="Articles indisponibles">{error?.message}</ErrorState>
          )}
        </section>
        {popular && popular.data.length > 0 ? (
          <section aria-labelledby="populaires" className="flex flex-col gap-4">
            <h2 id="populaires" className="text-2xl font-bold">Les plus lus</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-6">
              {popular.data.map((p) => (
                <li key={p.slug}><Link href={`/blog/${p.slug}`}>{p.title}</Link></li>
              ))}
            </ol>
          </section>
        ) : null}
      </Container>
    </>
  );
}
