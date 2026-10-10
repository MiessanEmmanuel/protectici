<?php

namespace App\Http\Controllers\Reviews;

use App\Exceptions\ApiHttpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reviews\ReportReviewRequest;
use App\Models\Review;
use App\Models\User;
use App\Services\Reviews\ReviewService;
use Illuminate\Http\Response;

/** Signalement d'un avis publié (contrat §8.1) : idempotent, 204 dans tous les cas de succès. */
class ReviewReportController extends Controller
{
    public function store(ReportReviewRequest $request, int $id, ReviewService $reviews): Response
    {
        /** @var User $user */
        $user = $request->user();

        // Avis inexistant, supprimé ou non publié : 404 générique.
        $review = Review::query()->published()->findOrFail($id);
        if ($review->user_id === $user->id) {
            throw new ApiHttpException(403, 'Vous ne pouvez pas signaler votre propre avis.');
        }

        $reviews->report($review, $user, $request->validated('reason'), $request->validated('details'));

        return response()->noContent();
    }
}
