import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Tableau de données v9 : cadre 2 px encre, en-têtes en petites capitales sur sable,
 * lignes internes au filet discret (line-soft). Légende obligatoire ; le défilement horizontal
 * reste contenu dans la zone du tableau (jamais dans la page) et la zone est focalisable.
 */
export function Table({
  caption,
  children,
  className,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className="ui-table max-w-full scroll-x border-2 border-ink bg-white"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className={cn('w-full border-collapse text-left text-sm', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="ui-thead bg-c4 text-on-c4">{children}</thead>;
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'ui-th eyebrow border-b-2 border-ink px-3 py-2.5 align-bottom whitespace-nowrap',
        className,
      )}
      {...rest}
    />
  );
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('border-b border-line-soft last:border-b-0 [tbody>&]:hover:bg-c4/50', className)}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2.5 align-top', className)} {...rest} />;
}
