import Link from 'next/link';
import { Search } from 'lucide-react';
import type { PostCategory } from '@/lib/api/types';
import { cn } from '../ui/cn';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/** Recherche plein texte + navigation par catégories (formulaire GET : l'URL reste la source de vérité). */
export function BlogHeader({
  categories,
  currentCategory,
  q,
}: {
  categories: PostCategory[];
  currentCategory?: string;
  q?: string;
}) {
  const action = currentCategory ? `/blog/categorie/${currentCategory}` : '/blog';
  const chip =
    'inline-flex min-h-tap items-center border-2 px-4 text-sm font-extrabold no-underline';
  return (
    <div className="flex flex-col gap-4">
      <form
        action={action}
        method="get"
        role="search"
        aria-label="Rechercher dans le blog"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <Input
          label="Rechercher un article"
          name="q"
          type="search"
          maxLength={100}
          defaultValue={q}
          placeholder="Alarme, incendie, formation…"
          wrapperClassName="sm:flex-1"
        />
        <Button type="submit" variant="solid" size="lg">
          <Search aria-hidden="true" />
          Rechercher
        </Button>
      </form>
      <nav aria-label="Catégories du blog">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="/blog"
              aria-current={!currentCategory ? 'page' : undefined}
              className={cn(
                chip,
                !currentCategory
                  ? 'border-ink bg-ink text-white'
                  : 'border-ink bg-white text-ink hover:bg-c2 hover:text-on-c2',
              )}
            >
              Tous les articles
            </Link>
          </li>
          {categories.map((c) => {
            const active = c.slug === currentCategory;
            return (
              <li key={c.slug}>
                <Link
                  href={`/blog/categorie/${c.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    chip,
                    active
                      ? 'border-ink bg-ink text-white'
                      : 'border-ink bg-white text-ink hover:bg-c2 hover:text-on-c2',
                  )}
                >
                  {c.name} <span className="ml-1 text-xs opacity-80">({c.posts_count})</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
