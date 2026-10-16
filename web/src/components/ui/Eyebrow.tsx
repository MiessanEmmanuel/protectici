import type { ElementType, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Libellé en petites capitales espacées (au-dessus d'un titre, dans une bande).
 * Ce n'est pas un <label> de formulaire : utilisez Field pour cela.
 */
export function Eyebrow({
  as: Tag = 'span',
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cn('inline-flex items-center gap-2 eyebrow [&_svg]:size-[1.4em]', className)}>
      {children}
    </Tag>
  );
}
