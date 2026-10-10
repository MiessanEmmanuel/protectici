<?php

namespace App\Services\Quotes;

use App\Exceptions\ApiHttpException;
use App\Models\Provider;
use App\Models\QuoteRequest;
use App\Models\QuoteRequestRecipient;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Quote\QuoteMail;
use App\Services\AuditLogger;
use App\Services\Notifications\SafeNotifier;
use App\Support\PlainText;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Logique métier des devis : création des destinataires, acheminement, consultation, réponse, refus.
 * Les e-mails ne sont envoyés que lors d'une VRAIE transition (jamais pour une action rejouée).
 */
class QuoteService
{
    public function __construct(private readonly SafeNotifier $notifier, private readonly AuditLogger $audit) {}

    /**
     * Crée les destinataires manquants (un par fiche) et renvoie ceux qui viennent d'être créés.
     *
     * @param  list<int>  $providerIds
     * @return Collection<int, QuoteRequestRecipient>
     */
    public function addRecipients(QuoteRequest $quote, array $providerIds): Collection
    {
        $existing = $quote->recipients()->pluck('provider_id')->all();
        $created = new Collection;
        foreach (array_values(array_unique($providerIds)) as $providerId) {
            if (in_array($providerId, $existing, true)) {
                continue;
            }
            $recipient = $quote->recipients()->create(['provider_id' => $providerId]);
            $recipient->forceFill(['status' => 'sent', 'sent_at' => now()])->save();
            $created->push($recipient);
        }

        return $created;
    }

    /** Accusé au demandeur, « nouveau devis » aux prestataires ciblés et alerte admin (création réelle uniquement). */
    public function notifyCreated(QuoteRequest $quote): void
    {
        $this->notifier->toAddress($quote->email, new QuoteMail(QuoteMail::ACKNOWLEDGED, $quote->reference, $quote->first_name), 'quote_ack');
        $this->notifyProviders($quote, $quote->recipients()->get());
        $this->notifier->admins(new AdminAlert(
            AdminAlert::KIND_QUOTE_REQUESTED,
            'Nouvelle demande de devis',
            'Une demande de devis ('.$quote->reference.') a été reçue.',
            null,
            ['type' => 'quote_request', 'id' => $quote->id, 'reference' => $quote->reference],
        ));
    }

    /** @param Collection<int, QuoteRequestRecipient> $recipients */
    public function notifyProviders(QuoteRequest $quote, Collection $recipients): void
    {
        foreach ($recipients->load('provider.user') as $recipient) {
            $provider = $recipient->provider;
            $mail = new QuoteMail(QuoteMail::RECEIVED, $quote->reference, $provider->name);
            $owner = $provider->user;
            if ($owner instanceof User && $owner->is_active) {
                $this->notifier->toUser($owner, $mail, 'quote_received');
            } else {
                $this->notifier->toAddress($provider->email, $mail, 'quote_received');
            }
        }
    }

    /**
     * Acheminement par l'administration. Idempotent : rejouer la requête ne crée rien et n'envoie rien.
     *
     * @param  list<int>  $providerIds
     */
    public function dispatch(int $quoteId, array $providerIds, User $admin): QuoteRequest
    {
        [$quote, $created] = DB::transaction(function () use ($quoteId, $providerIds, $admin) {
            $quote = QuoteRequest::query()->lockForUpdate()->findOrFail($quoteId);
            if (! $quote->isOpen()) {
                throw new ApiHttpException(409, 'Cette demande de devis est close ou annulée.');
            }

            $created = $this->addRecipients($quote, $providerIds);
            if ($created->isNotEmpty()) {
                $this->audit->record('quote_dispatched', $quote, null, [
                    'provider_ids' => $created->pluck('provider_id')->all(),
                ], null, $admin);
            }
            if ($quote->status === 'new' && $quote->recipients()->exists()) {
                $quote->forceFill(['status' => 'sent'])->save();
            }

            return [$quote, $created];
        });

        $this->notifyProviders($quote, $created);

        return $quote;
    }

    public function changeStatus(int $quoteId, string $status, User $admin): QuoteRequest
    {
        return DB::transaction(function () use ($quoteId, $status, $admin) {
            $quote = QuoteRequest::query()->lockForUpdate()->findOrFail($quoteId);
            if ($quote->status !== $status) {
                $old = $quote->status;
                $quote->forceFill(['status' => $status])->save();
                $this->audit->record('quote_status_changed', $quote, ['status' => $old], ['status' => $status], null, $admin);
            }

            return $quote;
        });
    }

    /** Passe `sent` → `viewed` (idempotent ; ne rétrograde jamais `replied` ni `declined`). */
    public function markViewed(QuoteRequestRecipient $recipient): void
    {
        QuoteRequestRecipient::query()->whereKey($recipient->id)->where('status', 'sent')
            ->update(['status' => 'viewed', 'viewed_at' => now()]);
    }

    public function reply(int $recipientId, User $owner, string $message, ?int $amount): QuoteRequestRecipient
    {
        $recipient = DB::transaction(function () use ($recipientId, $owner, $message, $amount) {
            $recipient = $this->lockOwned($recipientId, $owner);
            $this->assertAnswerable($recipient);

            $recipient->forceFill([
                'status' => 'replied',
                'replied_at' => now(),
                'viewed_at' => $recipient->viewed_at ?? now(),
                'response_message' => $message,
                'quoted_amount' => $amount,
            ])->save();

            $quote = $recipient->quoteRequest;
            if ($quote->status === 'sent') {
                $quote->forceFill(['status' => 'answered'])->save();
            }

            return $recipient;
        });

        $quote = $recipient->quoteRequest;
        $this->notifier->toAddress(
            $quote->email,
            new QuoteMail(QuoteMail::REPLIED, $quote->reference, $quote->first_name, $recipient->provider->name, $message, $amount),
            'quote_reply',
        );

        return $recipient;
    }

    public function decline(int $recipientId, User $owner, ?string $reason): QuoteRequestRecipient
    {
        return DB::transaction(function () use ($recipientId, $owner, $reason) {
            $recipient = $this->lockOwned($recipientId, $owner);
            if ($recipient->status === 'declined') {
                return $recipient;
            }
            $this->assertAnswerable($recipient);

            $recipient->forceFill([
                'status' => 'declined',
                'viewed_at' => $recipient->viewed_at ?? now(),
                'response_message' => $reason === null ? null : PlainText::single($reason),
            ])->save();

            return $recipient;
        });
    }

    /** Destinataire verrouillé, appartenant à une fiche de $owner ; 404 sinon. */
    private function lockOwned(int $recipientId, User $owner): QuoteRequestRecipient
    {
        return QuoteRequestRecipient::query()->inbox($owner)->lockForUpdate()
            ->with(['provider', 'quoteRequest'])->findOrFail($recipientId);
    }

    private function assertAnswerable(QuoteRequestRecipient $recipient): void
    {
        if (in_array($recipient->status, ['replied', 'declined'], true)) {
            throw new ApiHttpException(409, 'Vous avez déjà traité cette demande de devis.');
        }
        if (! $recipient->quoteRequest->isOpen()) {
            throw new ApiHttpException(409, 'Cette demande de devis est close ou annulée.');
        }
    }

    /**
     * Identifiants des fiches publiées parmi des slugs.
     *
     * @param  list<string>  $slugs
     * @return list<int>
     */
    public function publishedProviderIds(array $slugs): array
    {
        return Provider::query()->published()->whereIn('slug', $slugs)->pluck('id')->all();
    }
}
