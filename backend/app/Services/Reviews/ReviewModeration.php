<?php

namespace App\Services\Reviews;

use App\Exceptions\ApiHttpException;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Models\User;
use App\Notifications\Reviews\ReviewMail;
use App\Services\AuditLogger;
use App\Services\Notifications\SafeNotifier;
use Illuminate\Support\Facades\DB;

/**
 * Modération administrative des avis et des signalements (contrat §8.1). Chaque action est idempotente :
 * rejouée, elle ne renvoie ni e-mail ni ligne d'audit (seule une VRAIE transition produit des effets de bord).
 */
class ReviewModeration
{
    public const HIDDEN_BY_REPORT = 'Avis masqué suite à un signalement.';

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly SafeNotifier $notifier,
    ) {}

    public function approve(int $id, User $admin): Review
    {
        [$review, $changed] = DB::transaction(function () use ($id, $admin) {
            $review = Review::query()->lockForUpdate()->findOrFail($id);
            if ($review->status === 'approved' && $review->is_visible) {
                return [$review, false];
            }

            $review->forceFill([
                'status' => 'approved',
                'is_visible' => true,
                'rejection_reason' => null,
                'moderated_by' => $admin->id,
                'moderated_at' => now(),
            ])->save();
            $this->audit->record('review_approved', $review, null, null, $this->context($review), $admin);

            return [$review, true];
        });

        if ($changed) {
            $this->mailAuthor($review, ReviewMail::APPROVED, null, 'review_approved');
        }

        return $review->refresh();
    }

    public function reject(int $id, User $admin, string $reason): Review
    {
        [$review, $changed] = DB::transaction(function () use ($id, $admin, $reason) {
            $review = Review::query()->lockForUpdate()->findOrFail($id);
            if ($review->status === 'rejected' && ! $review->is_visible) {
                return [$review, false];
            }

            $review->forceFill([
                'status' => 'rejected',
                'is_visible' => false,
                'rejection_reason' => $reason,
                'moderated_by' => $admin->id,
                'moderated_at' => now(),
            ])->save();
            $this->audit->record('review_rejected', $review, null, null, $this->context($review), $admin);

            return [$review, true];
        });

        if ($changed) {
            $this->mailAuthor($review, ReviewMail::REJECTED, $reason, 'review_rejected');
        }

        return $review->refresh();
    }

    public function delete(int $id, User $admin): void
    {
        DB::transaction(function () use ($id, $admin) {
            $review = Review::query()->lockForUpdate()->find($id);
            if ($review === null) {
                return; // déjà supprimé : idempotent, sans nouvelle ligne d'audit
            }
            $review->delete();
            $this->audit->record('review_deleted', $review, null, null, $this->context($review), $admin);
        });
    }

    /** Accepte un signalement : masque l'avis et clôt les autres signalements ouverts du même avis. */
    public function acceptReport(int $id, User $admin): ReviewReport
    {
        return DB::transaction(function () use ($id, $admin) {
            $report = ReviewReport::query()->lockForUpdate()->findOrFail($id);
            if ($report->status === 'accepted') {
                return $report;
            }
            if ($report->status === 'dismissed') {
                throw new ApiHttpException(409, 'Ce signalement a déjà été rejeté.');
            }

            $review = Review::query()->lockForUpdate()->find($report->review_id);
            if ($review !== null) {
                $review->forceFill([
                    'status' => 'rejected',
                    'is_visible' => false,
                    'rejection_reason' => self::HIDDEN_BY_REPORT,
                    'moderated_by' => $admin->id,
                    'moderated_at' => now(),
                ])->save();
            }

            ReviewReport::query()->where('review_id', $report->review_id)->where('status', 'open')
                ->update(['status' => 'accepted', 'handled_by' => $admin->id, 'handled_at' => now(), 'updated_at' => now()]);

            $this->audit->record('review_report_accepted', $review, null, null, ['report_id' => $report->id, 'review_id' => $report->review_id], $admin);

            return $report->refresh();
        });
    }

    public function dismissReport(int $id, User $admin): ReviewReport
    {
        return DB::transaction(function () use ($id, $admin) {
            $report = ReviewReport::query()->lockForUpdate()->findOrFail($id);
            if ($report->status === 'dismissed') {
                return $report;
            }
            if ($report->status === 'accepted') {
                throw new ApiHttpException(409, 'Ce signalement a déjà été accepté.');
            }

            $report->forceFill(['status' => 'dismissed', 'handled_by' => $admin->id, 'handled_at' => now()])->save();
            $this->audit->record('review_report_dismissed', $report->review, null, null, ['report_id' => $report->id, 'review_id' => $report->review_id], $admin);

            return $report;
        });
    }

    private function mailAuthor(Review $review, string $event, ?string $text, string $context): void
    {
        $review->loadMissing(['user', 'provider']);
        if ($review->provider === null) {
            return;
        }
        $this->notifier->toUser($review->user, new ReviewMail($event, $review->provider->name, $review->provider->slug, $text), $context);
    }

    /** @return array<string, int> identifiants seulement */
    private function context(Review $review): array
    {
        return ['review_id' => $review->id, 'provider_id' => $review->provider_id];
    }
}
