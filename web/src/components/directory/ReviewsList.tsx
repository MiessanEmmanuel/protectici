import type { Review } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { ReportReviewButton } from '../reviews/ReportReviewButton';
import { RatingStars } from '../ui/RatingStars';

export function ReviewsList({ reviews, redirectTo }: { reviews: Review[]; redirectTo: string }) {
  return (
    <ul className="flex flex-col gap-4">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-lg border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <RatingStars value={r.rating} showValue={false} />
            <p className="text-sm text-muted">
              {r.author} · <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
            </p>
          </div>
          {r.title ? <h4 className="mt-2 font-semibold">{r.title}</h4> : null}
          {/* Texte brut : React échappe le contenu, aucun HTML n'est interprété. */}
          <p className="mt-1 whitespace-pre-line">{r.body}</p>
          {r.provider_reply ? (
            <div className="mt-3 rounded-md bg-surface-alt p-3 text-sm">
              <p className="font-semibold">
                Réponse du prestataire
                {r.provider_replied_at ? ` · ${formatDate(r.provider_replied_at)}` : ''}
              </p>
              <p className="mt-1 whitespace-pre-line">{r.provider_reply}</p>
            </div>
          ) : null}
          <div className="mt-2 flex justify-end">
            <ReportReviewButton reviewId={r.id} redirectTo={redirectTo} />
          </div>
        </li>
      ))}
    </ul>
  );
}
