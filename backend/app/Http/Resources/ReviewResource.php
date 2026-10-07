<?php

namespace App\Http\Resources;

use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Review publié (contrat §2). L'auteur est toujours « Prénom N. », jamais d'email. */
class ReviewResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Review $r */
        $r = $this->resource;

        return [
            'id' => $r->id,
            'rating' => $r->rating,
            'title' => $r->title,
            'body' => $r->body,
            'author' => $this->author($r),
            'created_at' => $r->created_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'provider_reply' => $r->provider_reply,
            'provider_replied_at' => $r->provider_replied_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }

    private function author(Review $r): string
    {
        $user = $r->user;
        if ($user === null) {
            return 'Anonyme';
        }

        $initial = mb_strtoupper(mb_substr(trim($user->last_name), 0, 1));

        return trim($user->first_name.' '.($initial !== '' ? $initial.'.' : ''));
    }
}
