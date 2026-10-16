import type { ReactNode } from 'react';
import { cn } from './cn';

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('ui-empty border-2 border-ink bg-c4 p-8 text-center text-on-c4', className)}>
      <h2 className="text-xl heading-block">{title}</h2>
      {children ? <div className="mx-auto mt-2 max-w-prose text-ink-2">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Un problème est survenu',
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="border-2 border-danger bg-danger-soft p-6 text-center">
      <h2 className="text-xl heading-block text-danger">{title}</h2>
      {children ? <div className="mx-auto mt-2 max-w-prose">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
