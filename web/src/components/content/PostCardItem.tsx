import Link from 'next/link';
import type { PostCard } from '@/lib/api/types';
import { formatDate, pluralize } from '@/lib/format';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Tag';

/** Carte d'article du blog (liste, à la une, articles liés, accueil). */
export function PostCardItem({
  post,
  headingLevel = 3,
  showCover = true,
}: {
  post: PostCard;
  headingLevel?: 2 | 3;
  showCover?: boolean;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Card as="article" className="flex h-full flex-col gap-3 p-0 sm:p-0">
      {showCover && post.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover_url}
          alt={post.cover_alt ?? ''}
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
          className="aspect-video w-full rounded-t-lg object-cover"
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link
            href={`/blog/categorie/${post.category.slug}`}
            className="font-semibold text-primary-active"
          >
            {post.category.name}
          </Link>
          {post.is_featured ? <Badge tone="accent">À la une</Badge> : null}
        </div>
        <Heading className="text-lg font-bold">
          <Link href={`/blog/${post.slug}`} className="text-ink hover:text-primary">
            {post.title}
          </Link>
        </Heading>
        <p className="text-muted">{post.excerpt}</p>
        <p className="mt-auto pt-1 text-sm text-muted">
          <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          {post.reading_minutes ? ` · ${post.reading_minutes} min de lecture` : ''}
          {post.views_count > 0 ? ` · ${pluralize(post.views_count, 'vue', 'vues')}` : ''}
        </p>
      </div>
    </Card>
  );
}
