import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PostCardItem } from '@/components/content/PostCardItem';
import { SectionHeader } from '@/components/ui/Section';
import { toneAt, type Tone } from '@/components/ui/tone';
import { PopularPosts } from '@/components/content/PopularPosts';
import { PostComments } from '@/components/content/PostComments';
import { PostViewTracker } from '@/components/content/PostViewTracker';
import { SanitizedHtml } from '@/components/content/SanitizedHtml';
import { ShareLinks } from '@/components/directory/ShareLinks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { JsonLd } from '@/components/ui/JsonLd';
import { serverApi } from '@/lib/api/server';
import { SITE_URL } from '@/lib/env';
import { formatDate, pluralize } from '@/lib/format';
import { safe } from '@/lib/safe';

const RELATED_TONES: Tone[] = ['t1', 't2', 't3'];

type Props = { params: Promise<{ slug: string }> };

/**
 * Article : 404 → page introuvable ; toute autre erreur d'API est levée (error boundary, statut 5xx)
 * plutôt que de rendre une page vide en 200, indexable.
 */
const getPost = cache(async (slug: string) => {
  const [post, error] = await safe(serverApi.getPost(slug), () => notFound());
  if (!post) throw new Error(`Article indisponible (${error.status})`);
  return post;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
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
      ...(post.cover_url
        ? { images: [{ url: post.cover_url, alt: post.cover_alt ?? post.title }] }
        : {}),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const [post, [popular]] = await Promise.all([
    getPost(slug),
    safe(serverApi.listPosts({ per_page: 6, sort: 'popular' })),
  ]);
  const url = `${SITE_URL}/blog/${post.slug}`;
  const popularPosts = (popular?.data ?? []).filter((p) => p.slug !== post.slug).slice(0, 5);
  return (
    <>
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
      <PostViewTracker slug={post.slug} />
      <article>
        <header className="bg-c1 text-on-c1">
          <div className="wrap py-8 md:py-12 [&_a]:text-inherit">
            <Breadcrumb
              items={[
                { label: 'Accueil', href: '/' },
                { label: 'Blog', href: '/blog' },
                { label: post.category.name, href: `/blog/categorie/${post.category.slug}` },
                { label: post.title },
              ]}
            />
            <p className="mt-6">
              <Link
                href={`/blog/categorie/${post.category.slug}`}
                className="inline-flex min-h-tap items-center bg-c2 px-3 eyebrow text-on-c2! no-underline hover:underline"
              >
                {post.category.name}
              </Link>
            </p>
            <h1 className="mt-4 max-w-[24ch] text-section heading-block break-words">
              {post.title}
            </h1>
            <p className="mt-4 text-sm font-semibold opacity-90">
              <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
              {post.author_name ? ` · ${post.author_name}` : ''}
              {post.reading_minutes ? ` · ${post.reading_minutes} min de lecture` : ''}
              {` · ${pluralize(post.views_count, 'vue', 'vues')}`}
            </p>
          </div>
        </header>
        {/* Article 2/3 + les plus lus 1/3 */}
        <div className="wrap grid grid-cols-1 items-start gap-10 pb-section lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0">
            <figure className="border-x-2 border-b-2 border-ink bg-c4">
              {post.cover_url ? (
                // <img> et non next/image : next/image injecte un style en ligne bloqué par la CSP.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.cover_url}
                  alt={post.cover_alt ?? ''}
                  width={1200}
                  height={675}
                  fetchPriority="high"
                  decoding="async"
                  className="block aspect-video w-full object-cover"
                />
              ) : (
                <div aria-hidden="true" className="aspect-[16/6] placeholder-hatch" />
              )}
            </figure>
            <div className="flex flex-col gap-10 py-10">
              <SanitizedHtml html={post.body} />
              <div className="border-2 border-ink p-5">
                <ShareLinks url={url} title={post.title} label="Partager cet article" icons />
              </div>
            </div>
            <PostComments slug={post.slug} />
          </div>
          <PopularPosts posts={popularPosts} />
        </div>
      </article>
      {post.related.length > 0 ? (
        <section aria-labelledby="lies" className="bg-c4 text-on-c4">
          <div className="wrap py-section">
            <SectionHeader
              id="lies"
              title="Articles liés"
              more={{ href: '/blog', label: 'Tous les articles' }}
            />
            <ul className="grid gap-6 md:grid-cols-3">
              {post.related.map((p, i) => (
                <li key={p.slug} className="flex">
                  <PostCardItem post={p} tone={toneAt(RELATED_TONES, i)} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
