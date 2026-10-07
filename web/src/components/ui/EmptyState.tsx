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
    <div
      className={cn(
        'rounded-lg border border-dashed border-line bg-surface-alt p-8 text-center',
        className,
      )}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {children ? <div className="mx-auto mt-2 max-w-prose text-muted">{children}</div> : null}
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
    <div role="alert" className="rounded-lg border border-danger bg-danger-soft p-6 text-center">
      <h2 className="text-lg font-semibold text-danger">{title}</h2>
      {children ? <div className="mx-auto mt-2 max-w-prose">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
