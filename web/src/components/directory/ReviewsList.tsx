import type { Review } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { ReportReviewButton } from '../reviews/ReportReviewButton';
import { RatingStars } from '../ui/RatingStars';

export function ReviewsList({ reviews, redirectTo }: { reviews: Review[]; redirectTo: string }) {
  return (
    <ul className="flex flex-col">
      {reviews.map((r) => (
        <li key={r.id} className="-mb-0.5 border-2 border-ink bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <RatingStars value={r.rating} showValue={false} />
            <p className="text-sm text-ink-2">
              <strong className="text-ink">{r.author}</strong> · <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
            </p>
          </div>
          {r.title ? <h4 className="mt-3 text-lg font-extrabold">{r.title}</h4> : null}
          {/* Texte brut : React échappe le contenu, aucun HTML n'est interprété. */}
          <p className="mt-1 whitespace-pre-line">{r.body}</p>
          {r.provider_reply ? (
            <div className="mt-4 border-l-4 border-c1 bg-c4 p-4 text-sm">
              <p className="eyebrow">
                Réponse du prestataire
                {r.provider_replied_at ? ` · ${formatDate(r.provider_replied_at)}` : ''}
              </p>
              <p className="mt-1 whitespace-pre-line">{r.provider_reply}</p>
            </div>
          ) : null}
          <div className="mt-2 flex justify-end">
            <ReportReviewButton
              reviewId={r.id}
              redirectTo={redirectTo}
              label={`l’avis de ${r.author} du ${formatDate(r.created_at)}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
