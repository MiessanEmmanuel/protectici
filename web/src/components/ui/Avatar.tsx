import { cn } from './cn';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Logo du prestataire, ou initiales si absent. Décoratif : le nom est toujours à côté. */
export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={56}
        height={56}
        loading="lazy"
        decoding="async"
        className={cn('size-14 shrink-0 rounded-md object-cover', className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-14 shrink-0 items-center justify-center rounded-md bg-primary text-lg font-bold text-on-primary',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
