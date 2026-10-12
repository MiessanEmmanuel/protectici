<?php

namespace App\Services\Newsletter;

use App\Jobs\SyncNewsletterContact;
use App\Models\NewsletterSubscriber;
use App\Notifications\Newsletter\NewsletterMail;
use App\Services\AuditLogger;
use App\Services\Notifications\SafeNotifier;
use App\Services\PublicForms\FormSubmission;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Abonnement à la lettre d'information avec double opt-in (contrat §9.1, security.md §15) :
 *  - l'inscription répond TOUJOURS pareil (202) : aucune information sur l'existence de l'adresse ;
 *  - l'e-mail de confirmation n'est mis en file que pour une adresse nouvelle, en attente ou désinscrite ;
 *  - confirmation par lien signé 24 h à usage unique, désinscription par lien signé permanent (idempotente) ;
 *  - un désabonné ne garde que l'adresse, le statut et les dates (preuve), plus aucune autre donnée.
 */
class NewsletterService
{
    public function __construct(
        private readonly FormSubmission $submission,
        private readonly SafeNotifier $notifier,
        private readonly AuditLogger $audit,
    ) {}

    public function subscribe(string $email, ?string $source, ?string $idempotencyKey, string $ip): void
    {
        $email = mb_strtolower(trim($email));
        $send = false;
        $rawToken = null;
        $target = null;

        [, $created] = $this->submission->handle(
            'newsletter', 'newsletter_subscriber', null, ['email' => $email, 'source' => $source], $email, $idempotencyKey, $ip,
            function (?string $ipHash) use ($email, $source, &$send, &$rawToken, &$target): NewsletterSubscriber {
                $inserted = NewsletterSubscriber::query()->insertOrIgnore([
                    'email' => $email, 'status' => 'pending', 'source' => $source, 'consent_at' => now(), 'ip_hash' => $ipHash,
                ]);

                $subscriber = NewsletterSubscriber::query()->where('email', $email)->lockForUpdate()->firstOrFail();
                if ($inserted > 0 || in_array($subscriber->status, ['pending', 'unsubscribed'], true)) {
                    $rawToken = NewsletterTokens::make(NewsletterTokens::CONFIRM, $subscriber->id);
                    $subscriber->forceFill([
                        'status' => 'pending',
                        'confirmation_token_hash' => NewsletterTokens::hash($rawToken),
                        'unsubscribed_at' => null,
                        'consent_at' => now(),
                        'ip_hash' => $ipHash,
                        'source' => $source ?? $subscriber->source,
                    ])->save();
                    $send = true;
                }

                $target = $subscriber;

                return $subscriber;
            },
        );

        if ($created && $send && $rawToken !== null && $target instanceof NewsletterSubscriber) {
            $this->notifier->toAddress(
                $target->email,
                new NewsletterMail($this->link('/newsletter/confirmation', $rawToken), $this->unsubscribeUrl($target)),
                'newsletter_confirm',
            );
        }
    }

    /** Confirmation : idempotente (un lien déjà utilisé et encore authentique répond 200). */
    public function confirm(string $token): void
    {
        $id = NewsletterTokens::verify($token, NewsletterTokens::CONFIRM);
        if ($id === null) {
            $this->invalid();
        }

        $confirmedNow = DB::transaction(function () use ($id, $token) {
            $subscriber = NewsletterSubscriber::query()->whereKey($id)->lockForUpdate()->first();
            if ($subscriber === null) {
                $this->invalid();
            }
            if ($subscriber->status === 'confirmed') {
                return false;
            }
            if ($subscriber->status !== 'pending' || $subscriber->confirmation_token_hash === null
                || ! hash_equals($subscriber->confirmation_token_hash, NewsletterTokens::hash($token))) {
                $this->invalid();
            }

            $subscriber->forceFill(['status' => 'confirmed', 'confirmed_at' => now(), 'confirmation_token_hash' => null])->save();
            $this->audit->record('newsletter_confirmed', $subscriber, context: ['source' => $subscriber->source]);

            return $subscriber->id;
        });

        if ($confirmedNow !== false && SyncNewsletterContact::enabled()) {
            SyncNewsletterContact::dispatch($id, SyncNewsletterContact::SUBSCRIBE);
        }
    }

    public function unsubscribe(string $token): void
    {
        $id = NewsletterTokens::verify($token, NewsletterTokens::UNSUBSCRIBE);
        if ($id === null) {
            $this->invalid();
        }

        $changed = DB::transaction(function () use ($id) {
            $subscriber = NewsletterSubscriber::query()->whereKey($id)->lockForUpdate()->first();
            if ($subscriber === null) {
                $this->invalid();
            }
            if ($subscriber->status === 'unsubscribed') {
                return false;
            }
            $subscriber->forceFill([
                'status' => 'unsubscribed', 'unsubscribed_at' => now(),
                'confirmation_token_hash' => null, 'ip_hash' => null, 'source' => null,
            ])->save();
            $this->audit->record('newsletter_unsubscribed', $subscriber);

            return true;
        });

        if ($changed && SyncNewsletterContact::enabled()) {
            SyncNewsletterContact::dispatch($id, SyncNewsletterContact::UNSUBSCRIBE);
        }
    }

    public function unsubscribeUrl(NewsletterSubscriber $subscriber): string
    {
        return $this->link('/newsletter/desinscription', NewsletterTokens::make(NewsletterTokens::UNSUBSCRIBE, $subscriber->id));
    }

    private function link(string $path, string $token): string
    {
        return rtrim((string) config('auth.frontend_url'), '/').$path.'?token='.$token;
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages(['token' => ['Ce lien est invalide ou a expiré.']]);
    }
}
