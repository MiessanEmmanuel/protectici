import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { BlogHeader } from '@/components/content/BlogHeader';
import { PostList } from '@/components/content/PostList';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { serverApi } from '@/lib/api/server';
import { parseBlogParams } from '@/lib/blog-params';
import { safe } from '@/lib/safe';
import type { RawSearchParams } from '@/lib/search-params';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

const getCategories = cache(() => safe(serverApi.listBlogCategories()));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [cats] = await getCategories();
  const cat = cats?.find((c) => c.slug === slug);
  if (!cat) return { title: 'Catégorie du blog' };
  return {
    title: `${cat.name} — blog`,
    description: cat.description ?? `Articles de la catégorie ${cat.name}.`,
    alternates: { canonical: `/blog/categorie/${slug}` },
  };
}

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { query, q } = parseBlogParams(await searchParams);
  const [cats] = await getCategories();
  const cat = cats?.find((c) => c.slug === slug);
  if (cats && !cat) notFound();
  const [posts, error] = await safe(serverApi.listPosts({ ...query, category: slug }));
  return (
    <>
      <PageHeader title={cat?.name ?? 'Catégorie'} intro={cat?.description ?? undefined}>
        <Breadcrumb items={[{ label: 'Accueil', href: '/' }, { label: 'Blog', href: '/blog' }, { label: cat?.name ?? 'Catégorie' }]} />
      </PageHeader>
      <Container className="flex flex-col gap-8 py-8">
        <BlogHeader categories={cats ?? []} currentCategory={slug} q={q} />
        {posts ? (
          <PostList result={posts} basePath={`/blog/categorie/${slug}`} q={q} emptyTitle="Aucun article dans cette catégorie" />
        ) : (
          <ErrorState title="Articles indisponibles">{error?.message}</ErrorState>
        )}
      </Container>
    </>
  );
}
