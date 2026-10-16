import type { ElementType, HTMLAttributes } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

export function Card({ as: Tag = 'div', className, ...rest }: CardProps) {
  return <Tag className={cn('border-2 border-ink bg-white p-4 sm:p-5', className)} {...rest} />;
}
