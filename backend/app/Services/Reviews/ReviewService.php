<?php

namespace App\Services\Reviews;

use App\Exceptions\ApiHttpException;
use App\Models\Provider;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Reviews\ReviewMail;
use App\Services\Notifications\SafeNotifier;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/** Cycle de vie d'un avis côté utilisateur et prestataire (contrat §8.1). */
class ReviewService
{
    public function __construct(private readonly SafeNotifier $notifier) {}

    /** Un avis (non supprimé) existe déjà pour ce couple utilisateur / prestataire. */
    public function alreadyReviewed(Provider $provider, User $user): bool
    {
        return Review::query()->where('provider_id', $provider->id)->where('user_id', $user->id)->exists();
    }

    /** @param array{rating: int, title?: string|null, body: string} $data */
    public function create(Provider $provider, User $author, array $data): Review
    {
        try {
            $review = DB::transaction(function () use ($provider, $author, $data) {
                $review = (new Review)->fill($data);
                $review->forceFill([
                    'provider_id' => $provider->id,
                    'user_id' => $author->id,
                    'status' => 'pending',
                    'is_visible' => false,
                ])->save();

                return $review;
            });
        } catch (UniqueConstraintViolationException) {
            throw new ApiHttpException(409, 'Vous avez déjà donné un avis pour ce prestataire.');
        }

        $this->alertAdmins($review, $provider, 'Nouvel avis à modérer');

        return $review->refresh();
    }

    /** @param array{rating?: int, title?: string|null, body?: string} $changes */
    public function update(Review $review, array $changes): Review
    {
        $locked = DB::transaction(function () use ($review, $changes) {
            $locked = Review::query()->whereKey($review->id)->lockForUpdate()->firstOrFail();
            $locked->fill($changes);
            // Toute modification repasse l'avis en modération et le masque (note moyenne recalculée par trigger).
            $locked->forceFill([
                'status' => 'pending',
                'is_visible' => false,
                'rejection_reason' => null,
                'moderated_by' => null,
                'moderated_at' => null,
            ])->save();

            return $locked;
        });

        $this->alertAdmins($locked, $locked->provider, 'Avis modifié à modérer');

        return $locked->refresh();
    }

    public function delete(Review $review): void
    {
        DB::transaction(function () use ($review) {
            Review::query()->whereKey($review->id)->lockForUpdate()->first()?->delete();
        });
    }

    /** Signalement idempotent : retourne true seulement pour la création (alerte au 1er signalement). */
    public function report(Review $review, User $reporter, string $reason, ?string $details): bool
    {
        $created = false;
        DB::transaction(function () use ($review, $reporter, $reason, $details, &$created) {
            $exists = ReviewReport::query()->where('review_id', $review->id)->where('user_id', $reporter->id)->exists();
            if ($exists) {
                return;
            }
            $hadOpen = ReviewReport::query()->where('review_id', $review->id)->where('status', 'open')->exists();
            try {
                $report = (new ReviewReport)->fill(['review_id' => $review->id, 'reason' => $reason, 'details' => $details]);
                $report->forceFill(['user_id' => $reporter->id, 'status' => 'open'])->save();
            } catch (UniqueConstraintViolationException) {
                return; // rejeu concurrent : sans effet
            }
            $created = ! $hadOpen;
        });

        if ($created) {
            $this->notifier->admins(new AdminAlert(
                AdminAlert::KIND_REVIEW_REPORTED,
                'Avis signalé',
                'Un avis publié a été signalé et doit être examiné.',
                null,
                ['type' => 'review', 'id' => $review->id],
            ));
        }

        return $created;
    }

    /** Réponse unique du propriétaire (409 ensuite), avis publié de CETTE fiche uniquement. */
    public function reply(Provider $provider, int $reviewId, User $owner, string $body): Review
    {
        $review = DB::transaction(function () use ($provider, $reviewId, $owner, $body) {
            $review = Review::query()
                ->where('provider_id', $provider->id)
                ->where('status', 'approved')->where('is_visible', true)
                ->whereKey($reviewId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($review->provider_reply !== null) {
                throw new ApiHttpException(409, 'Vous avez déjà répondu à cet avis.');
            }

            $review->forceFill([
                'provider_reply' => $body,
                'provider_replied_at' => now(),
                'provider_replied_by' => $owner->id,
            ])->save();

            return $review;
        });

        $this->notifier->toUser(
            $review->user,
            new ReviewMail(ReviewMail::REPLIED, $provider->name, $provider->slug, $body),
            'review_replied',
        );

        return $review->load('user');
    }

    private function alertAdmins(Review $review, ?Provider $provider, string $title): void
    {
        $this->notifier->admins(new AdminAlert(
            AdminAlert::KIND_REVIEW_SUBMITTED,
            $title,
            'Un avis est en attente de modération.',
            $provider === null ? null : ['type' => 'provider', 'id' => $provider->id, 'slug' => $provider->slug, 'name' => $provider->name],
            ['type' => 'review', 'id' => $review->id],
        ));
    }
}
