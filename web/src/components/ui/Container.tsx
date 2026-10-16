import type { ElementType, HTMLAttributes } from 'react';
import { cn } from './cn';

interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

/** Conteneur de page : 1200 px max, gouttière 16 px (utilitaire `wrap`). */
export function Container({ as: Tag = 'div', className, ...rest }: ContainerProps) {
  return <Tag className={cn('wrap', className)} {...rest} />;
}
