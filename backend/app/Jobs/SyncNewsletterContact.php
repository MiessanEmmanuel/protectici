<?php

namespace App\Jobs;

use App\Models\NewsletterSubscriber;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;

/**
 * Synchronise un abonné vers l'Audience Resend (contrat §9.2), uniquement si NEWSLETTER_RESEND_SYNC=true.
 * Les messages d'erreur ne contiennent jamais l'adresse e-mail ni la réponse du service.
 */
class SyncNewsletterContact implements ShouldQueue
{
    use Queueable;

    public const SUBSCRIBE = 'subscribe';

    public const UNSUBSCRIBE = 'unsubscribe';

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [30, 300];

    public function __construct(public readonly int $subscriberId, public readonly string $action)
    {
        $this->afterCommit();
    }

    public static function enabled(): bool
    {
        return (bool) config('services.resend.newsletter_sync')
            && (string) config('services.resend.key') !== '' && (string) config('services.resend.audience_id') !== '';
    }

    public function handle(): void
    {
        if (! self::enabled()) {
            return;
        }

        $subscriber = NewsletterSubscriber::query()->find($this->subscriberId);
        if ($subscriber === null) {
            return;
        }

        $base = rtrim((string) config('services.resend.api_url'), '/').'/audiences/'.config('services.resend.audience_id').'/contacts';
        $client = Http::withToken((string) config('services.resend.key'))->acceptJson()->timeout(10);

        if ($this->action === self::SUBSCRIBE && $subscriber->status === 'confirmed') {
            $response = $client->post($base, ['email' => $subscriber->email, 'unsubscribed' => false]);
            if (! $response->successful()) {
                throw new \RuntimeException('Synchronisation Resend en échec (HTTP '.$response->status().').');
            }
            $id = $response->json('id');
            if (is_string($id) && $id !== '') {
                $subscriber->forceFill(['resend_contact_id' => mb_substr($id, 0, 100)])->save();
            }
        } elseif ($this->action === self::UNSUBSCRIBE && $subscriber->resend_contact_id !== null) {
            $response = $client->patch($base.'/'.rawurlencode($subscriber->resend_contact_id), ['unsubscribed' => true]);
            if (! $response->successful() && $response->status() !== 404) {
                throw new \RuntimeException('Synchronisation Resend en échec (HTTP '.$response->status().').');
            }
            $subscriber->forceFill(['resend_contact_id' => null])->save();
        }
    }
}
