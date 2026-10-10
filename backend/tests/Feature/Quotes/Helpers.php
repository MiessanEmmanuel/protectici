<?php

use App\Models\City;
use App\Models\Provider;
use App\Models\QuoteRequest;
use App\Models\QuoteRequestRecipient;
use App\Models\ServiceType;
use App\Models\User;

/*
| Utilitaires des tests de devis (chargés via require_once).
*/

if (! function_exists('quotePayload')) {
    /** Charge utile valide d'une demande de devis publique. */
    function quotePayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Awa',
            'last_name' => 'Traoré',
            'email' => 'awa.traore@example.com',
            'phone' => '07 09 44 51 11',
            'service_type_id' => ServiceType::factory()->create()->id,
            'city_id' => City::factory()->create()->id,
            'description' => 'Nous cherchons un gardiennage de nuit pour un entrepôt de 2000 m².',
            'consent' => true,
        ], $overrides);
    }

    /** Devis en base (référence attribuée par le défaut SQL), avec destinataires pour les fiches données. */
    function makeQuote(array $attributes = [], array $providers = []): QuoteRequest
    {
        $status = $attributes['status'] ?? ($providers === [] ? 'new' : 'sent');
        unset($attributes['status']);

        $quote = new QuoteRequest($attributes + [
            'first_name' => 'Awa', 'last_name' => 'Traoré', 'email' => 'awa.traore@example.com',
            'phone' => '+2250709445111', 'company_name' => 'Entrepôts Traoré',
            'service_type_id' => ServiceType::factory()->create()->id,
            'city_id' => City::factory()->create()->id,
            'description' => 'Gardiennage de nuit pour un entrepôt de 2000 m².',
            'budget_range' => '500 000 - 1 000 000 FCFA',
        ]);
        $quote->forceFill(['status' => $status, 'consent_at' => now()])->save();
        $quote->refresh();

        foreach ($providers as $provider) {
            $recipient = $quote->recipients()->create(['provider_id' => $provider->id]);
            $recipient->forceFill(['status' => 'sent', 'sent_at' => now()])->save();
        }

        return $quote;
    }

    function recipientOf(QuoteRequest $quote, Provider $provider): QuoteRequestRecipient
    {
        return QuoteRequestRecipient::query()->where('quote_request_id', $quote->id)->where('provider_id', $provider->id)->firstOrFail();
    }

    /** Propriétaire (rôle provider) et sa fiche publiée. @return array{0: User, 1: Provider} */
    function ownerWithProvider(array $providerAttributes = []): array
    {
        $owner = User::factory()->provider()->create();

        return [$owner, makeProvider($providerAttributes + ['user_id' => $owner->id])];
    }
}
