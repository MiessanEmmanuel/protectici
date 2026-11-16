<?php

namespace App\Services\Claims;

use App\Enums\EstablishmentType;
use App\Exceptions\ApiHttpException;
use App\Models\ConsentLog;
use App\Models\EstablishmentClaim;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Claims\ClaimMail;
use App\Services\AuditLogger;
use App\Services\Media\DocumentManager;
use App\Services\Notifications\SafeNotifier;
use App\Support\IpHasher;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Revendication d'une fiche sans propriétaire et attribution par l'administration (contrat §10.3).
 *
 * - Les décisions sont IDEMPOTENTES : rejouer une décision déjà appliquée ne change rien, n'écrit pas d'audit et
 *   n'envoie pas d'e-mail. Chaque transition réelle est faite sous verrou (demande puis fiche) et notifiée APRÈS
 *   la transaction, une seule fois.
 * - Le téléphone et le justificatif ne sont jamais écrits dans les journaux ni dans l'audit (identifiants seulement).
 * - Le justificatif est supprimé du disque dès que la demande est refusée (ou à l'anonymisation du demandeur).
 */
class ClaimService
{
    public const ALREADY_OWNED = 'Cette fiche est déjà gérée par un compte.';

    public const ALREADY_PENDING = 'Vous avez déjà une demande en cours pour cette fiche.';

    public const AUTO_REJECTION = 'Fiche attribuée à un autre compte.';

    public const ANONYMIZED_REJECTION = 'Compte anonymisé.';

    /** Plafond de demandes ENREGISTRÉES par compte et par 24 h (les tentatives invalides ne consomment rien). */
    public const DAILY_LIMIT = 5;

    public function __construct(
        private readonly DocumentManager $documents,
        private readonly AuditLogger $audit,
        private readonly SafeNotifier $notifier,
    ) {}

    /**
     * Relations nécessaires aux ressources MyClaim / AdminClaim (fiches supprimées logiquement incluses).
     *
     * @return array<int|string, mixed>
     */
    public static function relations(): array
    {
        return [
            'provider' => fn ($q) => $q->withTrashed()->with('city'),
            'stateForce' => fn ($q) => $q->withTrashed()->with('city'),
            'user',
            'reviewer',
        ];
    }

    /** Demande chargée avec ses relations d'affichage. */
    public function load(EstablishmentClaim $claim): EstablishmentClaim
    {
        return $claim->load(self::relations());
    }

    /**
     * Dépôt d'une demande par un compte vérifié sur une fiche PUBLIÉE (résolue par l'appelant).
     *
     * @param  array{submitter_role: string, phone: string, message?: string|null}  $data  données validées
     */
    public function submit(User $user, Provider|StateForce $establishment, array $data, UploadedFile $document, ?string $ip): EstablishmentClaim
    {
        $limiterKey = 'claims-submit:'.$user->id;
        if (RateLimiter::tooManyAttempts($limiterKey, self::DAILY_LIMIT)) {
            throw new ApiHttpException(429, 'Vous avez atteint la limite de 5 demandes par jour. Veuillez réessayer plus tard.', [
                'Retry-After' => (string) max(1, RateLimiter::availableIn($limiterKey)),
            ]);
        }

        // Pré-contrôles sans verrou (réponse rapide) ; ils sont refaits sous verrou ci-dessous.
        $this->assertClaimable($user, $establishment);

        ['binary' => $binary, 'mime' => $mime, 'extension' => $extension] = $this->documents->inspect($document, 'document');

        $kind = EstablishmentType::tryFromModel($establishment);
        $disk = (string) config('establishments.documents_disk');
        $path = 'claims/'.$kind->value.'/'.$establishment->getKey().'/'.Str::lower((string) Str::ulid()).'.'.$extension;

        Storage::disk($disk)->put($path, $binary, 'private');

        try {
            $claim = DB::transaction(function () use ($user, $establishment, $kind, $data, $document, $disk, $path, $binary, $mime, $ip) {
                $locked = $kind->query()->published()->whereKey($establishment->getKey())->lockForUpdate()->firstOrFail();
                $this->assertClaimable($user, $locked);

                $claim = new EstablishmentClaim;
                $claim->fill([
                    'submitter_role' => $data['submitter_role'],
                    'phone' => $data['phone'],
                    'message' => $data['message'] ?? null,
                ]);
                $claim->forceFill([
                    $kind->foreignKey() => $locked->getKey(),
                    'user_id' => $user->id,
                    'status' => 'pending',
                    'document_disk' => $disk,
                    'document_path' => $path,
                    'document_original_name' => $this->documents->safeName($document->getClientOriginalName()),
                    'document_mime_type' => $mime,
                    'document_size_bytes' => strlen($binary),
                ])->save();

                ConsentLog::create([
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'purpose' => 'claim',
                    'policy_version' => (string) config('app.policy_version'),
                    'granted' => true,
                    'ip_hash' => IpHasher::hash($ip),
                ]);

                $this->audit->record('claim_submitted', $locked, null, ['status' => 'pending'], [
                    'claim_id' => $claim->id, 'submitter_role' => $claim->submitter_role,
                ], $user);

                return $claim;
            });
        } catch (UniqueConstraintViolationException) {
            // Course : une autre requête du même compte a inséré une demande en attente (index unique partiel).
            $this->deleteFile($disk, $path);
            throw new ApiHttpException(409, self::ALREADY_PENDING);
        } catch (\Throwable $e) {
            $this->deleteFile($disk, $path);
            throw $e;
        }

        RateLimiter::hit($limiterKey, 86400);

        $this->notifier->toUser($user, $this->mail(ClaimMail::RECEIVED, $establishment), 'claim_received');
        $this->notifier->admins(new AdminAlert(
            AdminAlert::KIND_CLAIM_RECEIVED,
            'Nouvelle revendication de fiche',
            sprintf('Un compte demande à gérer la fiche « %s » (%s).', $establishment->name, $this->label($establishment)),
            $this->reference($establishment),
            ['type' => 'claim', 'id' => $claim->id],
        ));

        return $this->load($claim);
    }

    /** Acceptation : la fiche est rattachée au demandeur ; les autres demandes en attente sont refusées. */
    public function approve(int $claimId, User $admin): EstablishmentClaim
    {
        [$claim, $establishment, $others] = DB::transaction(function () use ($claimId, $admin) {
            $claim = EstablishmentClaim::query()->lockForUpdate()->findOrFail($claimId);

            if ($claim->status === 'approved') {
                return [$claim, null, []];
            }
            if ($claim->status !== 'pending') {
                throw new ApiHttpException(409, 'Cette demande a déjà été refusée.');
            }

            $establishment = $this->lockTarget($claim);
            if ($establishment === null) {
                throw new ApiHttpException(409, 'Cette fiche n\'existe plus.');
            }

            $owner = $claim->user_id === null ? null : User::query()->lockForUpdate()->find($claim->user_id);
            if (! $owner instanceof User || ! $owner->is_active) {
                throw new ApiHttpException(409, 'Le compte demandeur n\'est plus actif.');
            }
            if ($establishment->user_id !== null && $establishment->user_id !== $owner->id) {
                throw new ApiHttpException(409, self::ALREADY_OWNED);
            }

            $this->attach($establishment, $owner);

            $claim->forceFill(['status' => 'approved', 'reviewed_by' => $admin->id, 'reviewed_at' => now()])->save();
            $this->audit->record('claim_approved', $establishment, ['user_id' => null], ['user_id' => $owner->id], [
                'claim_id' => $claim->id,
            ], $admin);

            $others = $this->rejectOthers($establishment, $admin, $claim->id);

            return [$claim, $establishment, $others];
        });

        if ($establishment !== null) {
            $this->afterAttach($claim->user_id, $establishment, $others);
        }

        return $this->load($claim);
    }

    public function reject(int $claimId, User $admin, string $reason): EstablishmentClaim
    {
        [$claim, $done, $file] = DB::transaction(function () use ($claimId, $admin, $reason) {
            $claim = EstablishmentClaim::query()->lockForUpdate()->findOrFail($claimId);

            if ($claim->status === 'rejected') {
                return [$claim, false, null];
            }
            if ($claim->status !== 'pending') {
                throw new ApiHttpException(409, 'Cette demande a déjà été acceptée.');
            }

            $file = $this->markRejected($claim, $admin, $reason);
            $this->audit->record('claim_rejected', $this->target($claim), ['status' => 'pending'], ['status' => 'rejected'], [
                'claim_id' => $claim->id,
            ], $admin);

            return [$claim, true, $file];
        });

        if ($done) {
            if ($file !== null) {
                $this->deleteFile($file[0], $file[1]);
            }
            $this->mailRejected($claim);
        }

        return $this->load($claim);
    }

    /**
     * Attribution directe par l'administration (par l'e-mail d'un compte actif). Les demandes en attente du même
     * compte sont acceptées, celles des autres comptes refusées. Idempotent si la fiche appartient déjà à ce compte.
     */
    public function assignOwner(Provider|StateForce $establishment, string $email, User $admin): Provider|StateForce
    {
        $owner = User::query()
            ->where('email', mb_strtolower(trim($email)))
            ->where('is_active', true)
            ->whereNotNull('email_verified_at')
            ->first();
        if (! $owner instanceof User) {
            throw ValidationException::withMessages(['email' => ['Aucun compte actif avec cet e-mail.']]);
        }

        $kind = EstablishmentType::tryFromModel($establishment);

        [$locked, $others, $done] = DB::transaction(function () use ($kind, $establishment, $owner, $admin) {
            $locked = $kind->query()->whereKey($establishment->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->user_id === $owner->id) {
                return [$locked, [], false];
            }
            if ($locked->user_id !== null) {
                throw new ApiHttpException(409, self::ALREADY_OWNED);
            }

            User::query()->whereKey($owner->id)->lockForUpdate()->first();
            $this->attach($locked, $owner);

            EstablishmentClaim::query()
                ->where($kind->foreignKey(), $locked->getKey())
                ->where('user_id', $owner->id)->where('status', 'pending')
                ->update(['status' => 'approved', 'reviewed_by' => $admin->id, 'reviewed_at' => now(), 'updated_at' => now()]);

            $this->audit->record('establishment_owner_assigned', $locked, ['user_id' => null], ['user_id' => $owner->id], null, $admin);

            return [$locked, $this->rejectOthers($locked, $admin, null), true];
        });

        if ($done) {
            $this->afterAttach($owner->id, $locked, $others);
        }

        return $locked;
    }

    /**
     * Anonymisation d'un compte (UserAdministration::anonymize, dans sa transaction) : les demandes du compte sont
     * détachées, vidées de leurs données personnelles (téléphone, message, justificatif) ; les demandes en attente
     * sont refusées. Les fichiers sont supprimés après validation de la transaction.
     */
    public function forgetUser(int $userId): void
    {
        $claims = EstablishmentClaim::query()->where('user_id', $userId)->lockForUpdate()->get();
        $files = [];

        foreach ($claims as $claim) {
            if ($claim->document_path !== null) {
                $files[] = [$claim->document_disk, $claim->document_path];
            }
            $claim->forceFill([
                'user_id' => null,
                'phone' => '',
                'message' => null,
                'document_path' => null,
                'document_original_name' => null,
                'document_mime_type' => null,
                'document_size_bytes' => null,
            ]);
            if ($claim->status === 'pending') {
                $claim->forceFill(['status' => 'rejected', 'rejection_reason' => self::ANONYMIZED_REJECTION, 'reviewed_at' => now()]);
            }
            $claim->save();
        }

        DB::afterCommit(function () use ($files): void {
            foreach ($files as [$disk, $path]) {
                $this->deleteFile($disk, $path);
            }
        });
    }

    /**
     * Refus d'une demande : motif posé, justificatif détaché (à supprimer du disque après la transaction).
     *
     * @return array{0: string, 1: string}|null disque et chemin du justificatif détaché
     */
    private function markRejected(EstablishmentClaim $claim, User $admin, string $reason): ?array
    {
        $file = $claim->document_path === null ? null : [$claim->document_disk, $claim->document_path];

        $claim->forceFill([
            'status' => 'rejected',
            'rejection_reason' => $reason,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'document_path' => null,
            'document_original_name' => null,
            'document_mime_type' => null,
            'document_size_bytes' => null,
        ])->save();

        return $file;
    }

    private function assertClaimable(User $user, Provider|StateForce $establishment): void
    {
        if ($establishment->user_id !== null) {
            throw new ApiHttpException(409, self::ALREADY_OWNED);
        }

        $pending = EstablishmentClaim::query()
            ->where(EstablishmentType::tryFromModel($establishment)->foreignKey(), $establishment->getKey())
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->exists();
        if ($pending) {
            throw new ApiHttpException(409, self::ALREADY_PENDING);
        }
    }

    /** Fiche ciblée par la demande, verrouillée ; null si elle a été supprimée (même logiquement). */
    private function lockTarget(EstablishmentClaim $claim): Provider|StateForce|null
    {
        return $claim->provider_id !== null
            ? Provider::query()->whereKey($claim->provider_id)->lockForUpdate()->first()
            : StateForce::query()->whereKey($claim->state_force_id)->lockForUpdate()->first();
    }

    /** Fiche ciblée, y compris supprimée logiquement (audit, e-mails). */
    private function target(EstablishmentClaim $claim): Provider|StateForce|null
    {
        return $claim->provider_id !== null
            ? Provider::query()->withTrashed()->find($claim->provider_id)
            : StateForce::query()->withTrashed()->find($claim->state_force_id);
    }

    /** Rattachement (sous verrou) + rôle user → provider (jamais de rétrogradation d'un editor/admin). */
    private function attach(Provider|StateForce $establishment, User $owner): void
    {
        $establishment->forceFill(['user_id' => $owner->id])->save();

        if ($owner->role === User::ROLE_USER) {
            $owner->forceFill(['role' => User::ROLE_PROVIDER])->save(); // audit role_changed via UserObserver
        }
    }

    /**
     * Refuse les autres demandes en attente sur la fiche (motif standard).
     *
     * @return list<array{claim: EstablishmentClaim, file: array{0: string, 1: string}|null}>
     */
    private function rejectOthers(Provider|StateForce $establishment, User $admin, ?int $exceptId): array
    {
        $others = EstablishmentClaim::query()
            ->where(EstablishmentType::tryFromModel($establishment)->foreignKey(), $establishment->getKey())
            ->where('status', 'pending')
            ->when($exceptId !== null, fn ($q) => $q->whereKeyNot($exceptId))
            ->lockForUpdate()
            ->get();

        $out = [];
        foreach ($others as $other) {
            $file = $this->markRejected($other, $admin, self::AUTO_REJECTION);
            $this->audit->record('claim_rejected', $establishment, ['status' => 'pending'], ['status' => 'rejected'], [
                'claim_id' => $other->id, 'automatic' => true,
            ], $admin);
            $out[] = ['claim' => $other, 'file' => $file];
        }

        return $out;
    }

    /**
     * Après validation : e-mail « acceptée » au nouveau propriétaire, e-mails « refusée » aux autres demandeurs,
     * suppression des justificatifs refusés.
     *
     * @param  list<array{claim: EstablishmentClaim, file: array{0: string, 1: string}|null}>  $others
     */
    private function afterAttach(?int $ownerId, Provider|StateForce $establishment, array $others): void
    {
        $owner = $ownerId === null ? null : User::query()->find($ownerId);
        $this->notifier->toUser($owner, $this->mail(ClaimMail::APPROVED, $establishment), 'claim_approved');

        foreach ($others as ['claim' => $other, 'file' => $file]) {
            if ($file !== null) {
                $this->deleteFile($file[0], $file[1]);
            }
            $this->mailRejected($other);
        }
    }

    private function mailRejected(EstablishmentClaim $claim): void
    {
        $establishment = $this->target($claim);
        $user = $claim->user_id === null ? null : User::query()->find($claim->user_id);
        if ($establishment !== null) {
            $this->notifier->toUser($user, $this->mail(ClaimMail::REJECTED, $establishment, $claim->rejection_reason), 'claim_rejected');
        }
    }

    private function mail(string $event, Provider|StateForce $establishment, ?string $reason = null): ClaimMail
    {
        return new ClaimMail($event, $establishment->name, EstablishmentType::tryFromModel($establishment), $establishment->slug, $reason);
    }

    private function deleteFile(string $disk, string $path): void
    {
        if ($disk === '' || $path === '') {
            return;
        }
        try {
            Storage::disk($disk)->delete($path);
        } catch (\Throwable $e) {
            // Aucun chemin ni donnée personnelle dans le journal.
            Log::warning('Revendication : suppression de justificatif impossible.', ['error' => $e::class]);
        }
    }

    /** @return array{type: string, id: int, slug: string, name: string} */
    private function reference(Provider|StateForce $establishment): array
    {
        return [
            'type' => EstablishmentType::tryFromModel($establishment)->value,
            'id' => $establishment->id,
            'slug' => $establishment->slug,
            'name' => $establishment->name,
        ];
    }

    private function label(Provider|StateForce $establishment): string
    {
        return $establishment instanceof Provider ? 'prestataire' : 'force étatique';
    }
}
