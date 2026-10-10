<?php

namespace App\Http\Controllers\Feedback;

use App\Http\Controllers\Controller;
use App\Http\Requests\Feedback\StoreFeedbackRequest;
use App\Services\Feedback\FeedbackService;
use Illuminate\Http\JsonResponse;

class FeedbackController extends Controller
{
    public function store(StoreFeedbackRequest $request, FeedbackService $service): JsonResponse
    {
        // Champ piège rempli : succès simulé identique, RIEN n'est enregistré ni envoyé.
        if ($request->isBot()) {
            return $this->respond($service->fakeReference());
        }

        [$feedback] = $service->create($request->optionalUser(), $request->formData(), $request->idempotencyKey(), (string) $request->ip());

        return $this->respond($feedback->reference);
    }

    private function respond(string $reference): JsonResponse
    {
        return response()->json(['data' => [
            'reference' => $reference,
            'status' => 'new',
            'message' => FeedbackService::MESSAGE,
        ]], 201);
    }
}
