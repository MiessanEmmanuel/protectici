import Link from 'next/link';
import type { PostCard } from '@/lib/api/types';
import { formatDate, pluralize } from '@/lib/format';
import { Badge } from '../ui/Tag';
import { cn } from '../ui/cn';
import { toneClasses, type Tone } from '../ui/tone';

/**
 * Carte d'article v9 (liste, à la une, articles liés) : bande de catégorie en aplat, couverture
 * 16:10 (16:9 en grand format) ou hachures en attente d'image, titre en lien étiré.
 */
export function PostCardItem({
  post,
  headingLevel = 3,
  showCover = true,
  tone = 't1',
  big = false,
}: {
  post: PostCard;
  headingLevel?: 2 | 3;
  showCover?: boolean;
  tone?: Tone;
  big?: boolean;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const ratio = big ? 'aspect-video' : 'aspect-[16/10]';
  return (
    <article className="group relative flex h-full flex-col border-2 border-ink bg-white text-ink">
      <p
        className={cn(
          'relative z-10 flex items-center justify-between gap-2 px-3.5 py-2',
          toneClasses[tone],
        )}
      >
        <Link
          href={`/blog/categorie/${post.category.slug}`}
          className="inline-flex min-h-6 items-center eyebrow tracking-[0.1em] text-inherit no-underline hover:underline"
        >
          {post.category.name}
        </Link>
        {post.is_featured ? (
          <Badge tone={tone === 't2' ? 'night' : 'accent'}>À la une</Badge>
        ) : null}
      </p>
      {showCover ? (
        <div className="overflow-hidden border-b-2 border-ink bg-c4">
          {post.cover_url ? (
            // <img> et non next/image : next/image injecte un style en ligne bloqué par la CSP.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover_url}
              alt={post.cover_alt ?? ''}
              width={big ? 1200 : 700}
              height={big ? 675 : 437}
              loading="lazy"
              decoding="async"
              className={cn(
                'block h-auto w-full object-cover transition-transform duration-400 group-hover:scale-[1.04] motion-reduce:group-hover:scale-100',
                ratio,
              )}
            />
          ) : (
            <div aria-hidden="true" className={cn('placeholder-hatch', ratio)} />
          )}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-[18px]">
        <Heading
          className={cn('leading-tight font-extrabold', big ? 'text-[2rem]' : 'text-[1.3rem]')}
        >
          <Link
            href={`/blog/${post.slug}`}
            className="link-stretched text-inherit no-underline group-hover:underline"
          >
            {post.title}
          </Link>
        </Heading>
        {post.excerpt ? <p className="text-ink-2">{post.excerpt}</p> : null}
        <p className="mt-auto pt-1 text-[0.8rem] text-ink-2">
          <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          {post.reading_minutes ? ` · ${post.reading_minutes} min de lecture` : ''}
          {post.views_count > 0 ? ` · ${pluralize(post.views_count, 'vue', 'vues')}` : ''}
        </p>
      </div>
    </article>
  );
}
