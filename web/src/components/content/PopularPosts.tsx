import Link from 'next/link';
import type { PostCard } from '@/lib/api/types';

/** Colonne « Les plus lus » (1/3 de page), collée sous l'en-tête fixe en défilant. */
export function PopularPosts({ posts }: { posts: PostCard[] }) {
  if (posts.length === 0) return null;
  return (
    <aside aria-labelledby="populaires" className="bg-c3 p-6 text-on-c3 md:p-8 lg:sticky lg:top-28">
      <h2 id="populaires" className="text-3xl heading-block">
        Les plus lus
      </h2>
      <ol className="mt-6">
        {posts.map((p, i) => (
          <li key={p.slug} className="border-t-2 border-current">
            <Link
              href={`/blog/${p.slug}`}
              className="flex min-h-14 items-center gap-4 py-3 text-base font-extrabold text-inherit no-underline hover:underline"
            >
              <span aria-hidden="true" className="text-figure leading-none font-black text-c2">
                {String(i + 1).padStart(2, '0')}
              </span>
              {p.title}
            </Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}
