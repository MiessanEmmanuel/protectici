<?php

namespace App\Http\Controllers\Reviews;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reviews\ReportReviewRequest;
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

        // Avis inexistant, supprimé ou non publié (404) et propre avis (403) : contrôlés par la requête avant validation.
        $review = $request->review();

        $reviews->report($review, $user, $request->validated('reason'), $request->validated('details'));

        return response()->noContent();
    }
}
