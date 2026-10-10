<?php

namespace App\Http\Controllers\Feedback;

use App\Http\Controllers\Controller;
use App\Http\Requests\Feedback\TrackFeedbackRequest;
use App\Models\FeedbackReply;
use App\Services\Feedback\FeedbackService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;

/** Suivi public d'un dossier : jamais de réponse interne, jamais de coordonnées, 404 générique. */
class FeedbackTrackController extends Controller
{
    public function __invoke(TrackFeedbackRequest $request, FeedbackService $service): JsonResponse
    {
        $feedback = $service->track($request->validated('reference'), $request->validated('email'));

        return response()->json(['data' => [
            'reference' => $feedback->reference,
            'status' => $feedback->status,
            'created_at' => ApiPage::iso($feedback->created_at),
            'provider_name' => $feedback->provider?->name,
            'replies' => $feedback->replies->map(fn (FeedbackReply $r) => [
                'body' => $r->body,
                'created_at' => ApiPage::iso($r->created_at),
            ])->values(),
        ]]);
    }
}
