import { cn } from './cn';

export function Spinner({
  label = 'Chargement…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center">
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent',
          className,
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-primary-soft-2/60', className)}
    />
  );
}

export function LoadingBlock({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-muted">
      <Spinner label="" />
      <span>{label}</span>
    </div>
  );
}
