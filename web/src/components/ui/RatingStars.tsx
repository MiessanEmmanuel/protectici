import { cn } from './cn';
import { formatRating } from '@/lib/format';

const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z';

function Star({ fill, uid }: { fill: 'full' | 'half' | 'empty'; uid: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" focusable="false">
      {fill === 'half' ? (
        <defs>
          <clipPath id={uid}>
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
      ) : null}
      <path
        d={STAR}
        className="fill-surface stroke-accent-text"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {fill !== 'empty' ? (
        <path
          d={STAR}
          className="fill-accent stroke-accent-text"
          strokeWidth="1.5"
          strokeLinejoin="round"
          clipPath={fill === 'half' ? `url(#${uid})` : undefined}
        />
      ) : null}
    </svg>
  );
}

interface RatingStarsProps {
  value: number;
  count?: number;
  className?: string;
  /** Affiche la note en chiffres (toujours recommandé : les étoiles dorées seules sont peu contrastées). */
  showValue?: boolean;
}

export function RatingStars({ value, count, className, showValue = true }: RatingStarsProps) {
  const clamped = Math.min(5, Math.max(0, value));
  const rounded = Math.round(clamped * 2) / 2;
  const noReview = count === 0;
  const text = noReview
    ? 'Pas encore d’avis'
    : `Note de ${formatRating(clamped)} sur 5${count !== undefined ? `, ${count} avis` : ''}`;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span role="img" aria-label={text} className="inline-flex">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = rounded >= i + 1 ? 'full' : rounded >= i + 0.5 ? 'half' : 'empty';
          return <Star key={i} fill={fill} uid={`star-${i}-${Math.round(clamped * 10)}`} />;
        })}
      </span>
      {showValue ? (
        <span className="text-sm text-muted" aria-hidden="true">
          {noReview ? (
            'Pas encore d’avis'
          ) : (
            <>
              <strong className="text-ink">{formatRating(clamped)}</strong>
              {count !== undefined ? ` (${count} avis)` : ''}
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}
