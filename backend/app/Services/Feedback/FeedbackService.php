<?php

namespace App\Services\Feedback;

use App\Exceptions\ApiHttpException;
use App\Models\Feedback;
use App\Models\FeedbackReply;
use App\Models\Provider;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Feedback\FeedbackMail;
use App\Services\AuditLogger;
use App\Services\Notifications\SafeNotifier;
use App\Services\PublicForms\FormSubmission;
use Illuminate\Support\Facades\DB;

/** « Dis-moi tout » : création publique, suivi par référence + e-mail, traitement par l'administration. */
class FeedbackService
{
    public const MESSAGE = 'Votre message a bien été reçu. Conservez ce numéro de suivi.';

    private const FILLABLE = ['civility', 'last_name', 'first_name', 'email', 'phone', 'action_type', 'target_type', 'service_type_id', 'topic_id', 'product_type', 'location', 'comment'];

    public function __construct(
        private readonly FormSubmission $submission,
        private readonly SafeNotifier $notifier,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $data  données validées sans champs techniques
     * @return array{0: Feedback, 1: bool}
     */
    public function create(?User $user, array $data, ?string $idempotencyKey, string $ip): array
    {
        /** @var array{0: Feedback, 1: bool} $result */
        $result = $this->submission->handle(
            'feedback', 'feedback', $user, $data, (string) ($data['email'] ?? ''), $idempotencyKey, $ip,
            function (?string $ipHash) use ($user, $data): Feedback {
                $feedback = (new Feedback)->fill(array_intersect_key($data, array_flip(self::FILLABLE)));
                $feedback->forceFill([
                    'user_id' => $user?->id,
                    'provider_id' => isset($data['provider_slug'])
                        ? Provider::query()->published()->where('slug', $data['provider_slug'])->value('id')
                        : null,
                    'consent_at' => now(),
                    'ip_hash' => $ipHash,
                ])->save();

                return $feedback->refresh(); // relit la référence DMT-AAAA-nnnnnn générée par la base
            },
        );

        [$feedback, $created] = $result;
        if ($created) {
            $this->notifier->toAddress($feedback->email, new FeedbackMail(FeedbackMail::RECEIVED, $feedback->reference, $feedback->first_name), 'feedback_received');
            $this->notifier->admins(new AdminAlert(
                AdminAlert::KIND_FEEDBACK_RECEIVED,
                'Nouveau message « Dis-moi tout »',
                'Un nouveau dossier « Dis-moi tout » attend un traitement.',
                null,
                ['type' => 'feedback', 'id' => $feedback->id, 'reference' => $feedback->reference],
            ));
        }

        return $result;
    }

    /** Référence factice pour la réponse « succès simulé » du champ piège. */
    public function fakeReference(): string
    {
        return 'DMT-'.date('Y').'-'.str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT);
    }

    /** Suivi public : 404 générique identique que la référence soit inconnue ou l'e-mail faux. */
    public function track(string $reference, string $email): Feedback
    {
        $feedback = Feedback::query()
            ->with(['provider:id,name', 'replies' => fn ($q) => $q->where('is_internal', false)->orderBy('id')])
            ->where('reference', $reference)
            ->where('email', $email) // colonne citext : comparaison insensible à la casse
            ->first();

        if ($feedback === null) {
            throw new ApiHttpException(404, 'Aucun dossier ne correspond à ces informations.');
        }

        return $feedback;
    }

    /** @param array{status?: string, assigned_to?: int|null} $changes */
    public function update(Feedback $feedback, array $changes): Feedback
    {
        return DB::transaction(function () use ($feedback, $changes) {
            $locked = Feedback::query()->whereKey($feedback->id)->lockForUpdate()->firstOrFail();

            if (array_key_exists('status', $changes) && $changes['status'] !== $locked->status) {
                $old = $locked->status;
                $locked->status = $changes['status'];
                if (in_array($changes['status'], ['resolved', 'closed'], true)) {
                    $locked->resolved_at ??= now();
                } else {
                    $locked->resolved_at = null; // dossier rouvert
                }
                $this->audit->record('feedback_status_changed', $locked, ['status' => $old], ['status' => $changes['status']]);
            }

            if (array_key_exists('assigned_to', $changes) && $changes['assigned_to'] !== $locked->assigned_to) {
                $old = $locked->assigned_to;
                $locked->assigned_to = $changes['assigned_to'];
                $this->audit->record('feedback_assigned', $locked, ['assigned_to' => $old], ['assigned_to' => $changes['assigned_to']]);
            }

            $locked->save();

            return $locked;
        });
    }

    /**
     * Réponse de l'administration. Interne : simple note. Non interne : e-mail à l'auteur, UNE fois par réponse
     * (une double soumission identique en moins d'une minute renvoie la réponse existante sans nouvel e-mail).
     */
    public function reply(Feedback $feedback, User $admin, string $body, bool $internal): FeedbackReply
    {
        [$reply, $fresh] = DB::transaction(function () use ($feedback, $admin, $body, $internal) {
            $locked = Feedback::query()->whereKey($feedback->id)->lockForUpdate()->firstOrFail();

            if (! $internal && ($locked->email === null || $locked->email === '')) {
                throw new ApiHttpException(409, 'Ce dossier est anonymisé : aucune réponse ne peut être envoyée.');
            }

            $duplicate = FeedbackReply::query()
                ->where('feedback_id', $locked->id)->where('user_id', $admin->id)
                ->where('body', $body)->where('is_internal', $internal)
                ->where('created_at', '>=', now()->subMinute())
                ->first();
            if ($duplicate !== null) {
                return [$duplicate, false];
            }

            $reply = (new FeedbackReply)->fill(['feedback_id' => $locked->id, 'body' => $body, 'is_internal' => $internal]);
            $reply->forceFill(['user_id' => $admin->id, 'sent_at' => $internal ? null : now()])->save();
            $this->audit->record('feedback_replied', $locked, null, null, ['reply_id' => $reply->id, 'is_internal' => $internal]);

            return [$reply, true];
        });

        if ($fresh && ! $internal) {
            $this->notifier->toAddress($feedback->email, new FeedbackMail(FeedbackMail::REPLY, $feedback->reference, $feedback->first_name, $body), 'feedback_reply');
        }

        return $reply;
    }
}
