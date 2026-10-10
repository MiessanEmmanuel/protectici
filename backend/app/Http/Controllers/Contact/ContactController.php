<?php

namespace App\Http\Controllers\Contact;

use App\Http\Controllers\Controller;
use App\Http\Requests\Contact\StoreContactRequest;
use App\Services\Contact\ContactService;
use Illuminate\Http\JsonResponse;

class ContactController extends Controller
{
    public function store(StoreContactRequest $request, ContactService $service): JsonResponse
    {
        // Champ piège rempli : succès simulé identique, rien n'est enregistré ni envoyé.
        if (! $request->isBot()) {
            $service->create($request->optionalUser(), $request->formData(), $request->idempotencyKey(), (string) $request->ip());
        }

        return response()->json(['data' => ['message' => ContactService::MESSAGE]], 201);
    }
}
