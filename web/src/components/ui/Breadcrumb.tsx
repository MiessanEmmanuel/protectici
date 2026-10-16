import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

/** Fil d'Ariane v9 : petites capitales, couleur héritée du fond (aplat bleu ou blanc). */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d’Ariane" className="eyebrow tracking-[0.08em]">
      <ol className="flex flex-wrap items-center gap-x-2">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-2">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-tap items-center text-inherit underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'truncate opacity-80' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last ? (
                <span aria-hidden="true" className="opacity-60">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
