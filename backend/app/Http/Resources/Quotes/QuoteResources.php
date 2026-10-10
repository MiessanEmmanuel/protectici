<?php

namespace App\Http\Resources\Quotes;

use App\Http\Resources\OptionResource;
use App\Models\QuoteRequest;
use App\Models\QuoteRequestRecipient;
use App\Support\ApiPage;

/**
 * Sérialisation des devis (contrat §8.3). Les coordonnées du demandeur n'apparaissent que dans ProviderQuote
 * (prestataire destinataire) et dans AdminQuote / AdminQuoteRow (administration).
 */
final class QuoteResources
{
    /**
     * ProviderQuote : `id` = identifiant du DESTINATAIRE (quote_request_recipients.id). Le destinataire doit avoir
     * ses relations `provider` et `quoteRequest.{serviceType,city,district}` chargées.
     *
     * @return array<string, mixed>
     */
    public static function providerQuote(QuoteRequestRecipient $recipient): array
    {
        $quote = $recipient->quoteRequest;

        return [
            'id' => $recipient->id,
            'reference' => $quote->reference,
            'provider' => ['slug' => $recipient->provider->slug, 'name' => $recipient->provider->name],
            'requester' => [
                'name' => trim($quote->first_name.' '.$quote->last_name),
                'email' => $quote->email,
                'phone' => $quote->phone,
                'company_name' => $quote->company_name,
            ],
            'service' => (new OptionResource($quote->serviceType))->resolve(),
            'city' => ['name' => $quote->city->name],
            'district' => $quote->district === null ? null : ['name' => $quote->district->name],
            'description' => $quote->description,
            'desired_start_date' => $quote->desired_start_date?->format('Y-m-d'),
            'budget_range' => $quote->budget_range,
            'status' => $recipient->status,
            'sent_at' => ApiPage::iso($recipient->sent_at),
            'viewed_at' => ApiPage::iso($recipient->viewed_at),
            'replied_at' => ApiPage::iso($recipient->replied_at),
            'response_message' => $recipient->response_message,
            'quoted_amount' => $recipient->quoted_amount,
        ];
    }

    /** @return array<string, mixed> */
    public static function adminRow(QuoteRequest $quote): array
    {
        return [
            'id' => $quote->id,
            'reference' => $quote->reference,
            'requester_name' => trim($quote->first_name.' '.$quote->last_name),
            'requester_email' => $quote->email,
            'service' => (new OptionResource($quote->serviceType))->resolve(),
            'city' => ['name' => $quote->city->name],
            'status' => $quote->status,
            'recipients_count' => $quote->recipients_count ?? $quote->recipients()->count(),
            'created_at' => ApiPage::iso($quote->created_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function adminDetail(QuoteRequest $quote): array
    {
        $quote->loadMissing(['serviceType', 'city', 'district', 'recipients.provider']);

        return self::adminRow($quote) + [
            'phone' => $quote->phone,
            'company_name' => $quote->company_name,
            'district' => $quote->district === null ? null : ['name' => $quote->district->name],
            'description' => $quote->description,
            'desired_start_date' => $quote->desired_start_date?->format('Y-m-d'),
            'budget_range' => $quote->budget_range,
            'recipients' => $quote->recipients->sortBy('id')->map(fn (QuoteRequestRecipient $r) => [
                'id' => $r->id,
                'provider' => ['id' => $r->provider_id, 'name' => $r->provider->name],
                'status' => $r->status,
                'sent_at' => ApiPage::iso($r->sent_at),
                'viewed_at' => ApiPage::iso($r->viewed_at),
                'replied_at' => ApiPage::iso($r->replied_at),
                'response_message' => $r->response_message,
                'quoted_amount' => $r->quoted_amount,
            ])->values()->all(),
        ];
    }
}
