<?php

namespace App\Http\Resources\Reviews;

use App\Models\Review;
use App\Models\ReviewReport;
use App\Support\ApiPage;

/** Sérialisation des avis et signalements (contrat §8.1). Tableaux dédiés : aucune donnée hors contrat. */
final class ReviewPresenter
{
    /**
     * MyReview : l'auteur voit son propre avis, quel que soit son statut.
     *
     * @return array<string, mixed>
     */
    public static function mine(Review $r): array
    {
        return [
            'id' => $r->id,
            'provider' => ['slug' => $r->provider?->slug, 'name' => $r->provider?->name],
            'rating' => $r->rating,
            'title' => $r->title,
            'body' => $r->body,
            'status' => $r->status,
            'rejection_reason' => $r->rejection_reason,
            'is_visible' => $r->is_visible,
            'created_at' => ApiPage::iso($r->created_at),
            'provider_reply' => $r->provider_reply,
        ];
    }

    /**
     * Avis reçu par une fiche (vue propriétaire) : auteur « Prénom N. » sans e-mail.
     *
     * @return array<string, mixed>
     */
    public static function received(Review $r): array
    {
        return [
            'id' => $r->id,
            'rating' => $r->rating,
            'title' => $r->title,
            'body' => $r->body,
            'author' => self::authorName($r),
            'status' => $r->status,
            'created_at' => ApiPage::iso($r->created_at),
            'provider_reply' => $r->provider_reply,
            'provider_replied_at' => ApiPage::iso($r->provider_replied_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function adminRow(Review $r): array
    {
        $u = $r->user;

        return [
            'id' => $r->id,
            'provider' => ['id' => $r->provider?->id, 'slug' => $r->provider?->slug, 'name' => $r->provider?->name],
            'author' => $u === null ? null : ['id' => $u->id, 'name' => trim($u->first_name.' '.$u->last_name), 'email' => $u->email],
            'rating' => $r->rating,
            'title' => $r->title,
            'body' => $r->body,
            'status' => $r->status,
            'is_visible' => $r->is_visible,
            'reports_count' => (int) ($r->getAttribute('reports_count') ?? $r->reports()->count()),
            'created_at' => ApiPage::iso($r->created_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function adminReport(ReviewReport $report): array
    {
        $review = $report->review;
        $reporter = $report->reporter;

        return [
            'id' => $report->id,
            'review' => [
                'id' => $review?->id,
                'rating' => $review?->rating,
                'body_excerpt' => $review === null ? '' : mb_strimwidth($review->body, 0, 140, '…'),
                'provider_name' => $review?->provider?->name,
            ],
            'reporter' => $reporter === null ? null : ['id' => $reporter->id, 'name' => trim($reporter->first_name.' '.$reporter->last_name)],
            'reason' => $report->reason,
            'details' => $report->details,
            'status' => $report->status,
            'created_at' => ApiPage::iso($report->created_at),
        ];
    }

    private static function authorName(Review $r): string
    {
        $user = $r->user;
        if ($user === null) {
            return 'Anonyme';
        }
        $initial = mb_strtoupper(mb_substr(trim($user->last_name), 0, 1));

        return trim($user->first_name.' '.($initial !== '' ? $initial.'.' : ''));
    }
}
