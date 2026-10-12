<?php

namespace App\Http\Controllers\Newsletter;

use App\Http\Controllers\Controller;
use App\Http\Requests\Newsletter\SubscribeRequest;
use App\Http\Requests\Newsletter\TokenRequest;
use App\Services\Newsletter\NewsletterService;
use Illuminate\Http\JsonResponse;

/** Lettre d'information (contrat §9.1) : double opt-in, réponse d'inscription identique quelle que soit l'adresse. */
class NewsletterController extends Controller
{
    public function __construct(private readonly NewsletterService $service) {}

    public function subscribe(SubscribeRequest $request): JsonResponse
    {
        if (! $request->isBot()) {
            $v = $request->formData();
            $this->service->subscribe($v['email'], $v['source'] ?? null, $request->idempotencyKey(), (string) $request->ip());
        }

        return response()->json(['data' => ['message' => 'Si cette adresse est valide, un e-mail de confirmation vient de vous être envoyé.']], 202);
    }

    public function confirm(TokenRequest $request): JsonResponse
    {
        $this->service->confirm($request->validated('token'));

        return response()->json(['data' => ['status' => 'confirmed']]);
    }

    public function unsubscribe(TokenRequest $request): JsonResponse
    {
        $this->service->unsubscribe($request->validated('token'));

        return response()->json(['data' => ['status' => 'unsubscribed']]);
    }
}
