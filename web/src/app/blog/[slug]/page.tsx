import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PostCardItem } from '@/components/content/PostCardItem';
import { PostComments } from '@/components/content/PostComments';
import { SanitizedHtml } from '@/components/content/SanitizedHtml';
import { ShareLinks } from '@/components/directory/ShareLinks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { JsonLd } from '@/components/ui/JsonLd';
import { serverApi } from '@/lib/api/server';
import { SITE_URL } from '@/lib/env';
import { formatDate, pluralize } from '@/lib/format';
import { safe } from '@/lib/safe';

type Props = { params: Promise<{ slug: string }> };

const getPost = cache((slug: string) => safe(serverApi.getPost(slug), () => notFound()));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post] = await getPost(slug);
  if (!post) return { title: 'Article' };
  const description = post.seo_description ?? post.excerpt;
  return {
    title: post.seo_title ?? post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.seo_title ?? post.title,
      description,
      type: 'article',
      url: `/blog/${post.slug}`,
      publishedTime: post.published_at,
      ...(post.cover_url ? { images: [{ url: post.cover_url, alt: post.cover_alt ?? post.title }] } : {}),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const [post, error] = await getPost(slug);
  if (!post) {
    return (
      <Container className="py-10">
        <ErrorState title="Article indisponible">{error?.message}</ErrorState>
      </Container>
    );
  }
  const url = `${SITE_URL}/blog/${post.slug}`;
  return (
    <Container className="py-8">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          datePublished: post.published_at,
          mainEntityOfPage: url,
          articleSection: post.category.name,
          ...(post.cover_url ? { image: [post.cover_url] } : {}),
          author: { '@type': 'Organization', name: post.author_name ?? 'ProtectIci' },
          publisher: { '@type': 'Organization', name: 'ProtectIci' },
        }}
      />
      <article className="mx-auto flex max-w-3xl flex-col gap-6">
        <Breadcrumb
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: post.category.name, href: `/blog/categorie/${post.category.slug}` },
            { label: post.title },
          ]}
        />
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{post.title}</h1>
          <p className="text-sm text-muted">
            <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
            {post.author_name ? ` · ${post.author_name}` : ''}
            {post.reading_minutes ? ` · ${post.reading_minutes} min de lecture` : ''}
            {` · ${pluralize(post.views_count, 'vue', 'vues')}`}
          </p>
        </header>
        {post.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover_url} alt={post.cover_alt ?? ''} width={960} height={540} fetchPriority="high" decoding="async" className="aspect-video w-full rounded-lg object-cover" />
        ) : null}
        <SanitizedHtml html={post.body} />
        <ShareLinks url={url} title={post.title} label="Partager cet article" />
      </article>
      {post.related.length > 0 ? (
        <section aria-labelledby="lies" className="mx-auto mt-12 flex max-w-5xl flex-col gap-4">
          <h2 id="lies" className="text-2xl font-bold">Articles liés</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {post.related.map((p) => (
              <li key={p.slug}><PostCardItem post={p} /></li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mx-auto mt-12 max-w-3xl">
        <PostComments slug={post.slug} />
      </div>
    </Container>
  );
}
