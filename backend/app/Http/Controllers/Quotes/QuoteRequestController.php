<?php

namespace App\Http\Controllers\Quotes;

use App\Http\Controllers\Controller;
use App\Http\Requests\PublicForms\StoreQuoteRequest;
use App\Models\QuoteRequest;
use App\Services\PublicForms\FormSubmission;
use App\Services\Quotes\QuoteService;
use Illuminate\Http\JsonResponse;

/** Demande de devis publique (contrat §8.3). Compte facultatif. */
class QuoteRequestController extends Controller
{
    public function store(StoreQuoteRequest $request, FormSubmission $forms, QuoteService $quotes): JsonResponse
    {
        // Robot : réponse de succès identique, rien n'est enregistré ni envoyé.
        if ($request->isBot()) {
            return $this->respond('DEV-'.now()->year.'-'.str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT));
        }

        $user = $request->optionalUser();
        $data = $request->formData();
        $providerIds = $quotes->publishedProviderIds(array_values((array) ($data['provider_slugs'] ?? [])));

        /** @var array{0: QuoteRequest, 1: bool} $result */
        $result = $forms->handle(
            'quote', 'quote_request', $user, $data, $data['email'], $request->idempotencyKey(), (string) $request->ip(),
            function (?string $ipHash) use ($data, $user, $providerIds, $quotes): QuoteRequest {
                $quote = new QuoteRequest(collect($data)->except('provider_slugs')->all());
                $quote->forceFill([
                    'user_id' => $user?->id,
                    'status' => $providerIds === [] ? 'new' : 'sent',
                    'consent_at' => now(),
                    'ip_hash' => $ipHash,
                ])->save();
                $quote->refresh(); // référence attribuée par le défaut SQL fn_next_reference
                $quotes->addRecipients($quote, $providerIds);

                return $quote;
            },
        );

        [$quote, $created] = $result;
        if ($created) {
            $quotes->notifyCreated($quote);
        }

        return $this->respond($quote->reference);
    }

    private function respond(string $reference): JsonResponse
    {
        return response()->json(['data' => [
            'reference' => $reference,
            'message' => 'Merci, votre demande de devis a bien été enregistrée. Conservez votre référence : '.$reference.'.',
        ]], 201);
    }
}
