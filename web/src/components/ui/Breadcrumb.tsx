import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d’Ariane" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {item.href && !last ? (
                <Link href={item.href} className="inline-flex min-h-6 items-center">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'text-ink' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
