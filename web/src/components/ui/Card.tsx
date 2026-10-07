import type { ElementType, HTMLAttributes } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

export function Card({ as: Tag = 'div', className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn('rounded-lg border border-line bg-surface p-4 shadow-card sm:p-5', className)}
      {...rest}
    />
  );
}
