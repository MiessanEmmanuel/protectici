<?php

namespace App\Services\PublicForms;

use App\Exceptions\ApiHttpException;
use App\Models\ConsentLog;
use App\Models\IdempotencyKey;
use App\Models\User;
use App\Support\IpHasher;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Création d'une ressource à partir d'un formulaire public (security.md §15, §18), de façon uniforme :
 *  - idempotence par `Idempotency-Key` (même clé + mêmes données = même ressource, aucune seconde ligne) ;
 *  - limites par IP (heure) et par e-mail (jour), comptées uniquement sur les créations réelles ;
 *  - transaction : clé d'idempotence + ressource + consentement tracé (`consent_logs`, finalité = $purpose) ;
 *  - l'IP n'est jamais stockée en clair (HMAC `ip_hash`).
 * L'appelant n'envoie e-mails et notifications que si `created` est vrai.
 */
class FormSubmission
{
    /**
     * @param  string  $purpose  finalité de consentement ET portée d'idempotence/limiteur : feedback | quote | contact
     * @param  string  $morph  alias morph de la ressource créée (ex. `feedback`)
     * @param  array<string, mixed>  $data  données validées (sans champs techniques) : base du hachage
     * @param  Closure(?string): Model  $create  reçoit l'ip_hash, doit créer et renvoyer la ressource (dans la transaction)
     * @return array{0: Model, 1: bool} [ressource, créée maintenant ?]
     */
    public function handle(
        string $purpose,
        string $morph,
        ?User $user,
        array $data,
        ?string $email,
        ?string $idempotencyKey,
        string $ip,
        Closure $create,
    ): array {
        $hash = $this->requestHash($purpose, $data);

        if ($idempotencyKey !== null) {
            $existing = $this->replay($user, $purpose, $morph, $idempotencyKey, $hash);
            if ($existing !== null) {
                return [$existing, false];
            }
        }

        $this->assertWithinLimits($purpose, $ip, $email);
        $ipHash = IpHasher::hash($ip);

        try {
            $model = DB::transaction(function () use ($purpose, $morph, $user, $email, $idempotencyKey, $hash, $ipHash, $create) {
                if ($idempotencyKey !== null) {
                    // L'index unique (user, scope, key) sérialise deux envois simultanés avec la même clé.
                    $key = IdempotencyKey::create([
                        'user_id' => $user?->id,
                        'scope' => $purpose,
                        'key' => $idempotencyKey,
                        'request_hash' => $hash,
                    ]);
                }

                $model = $create($ipHash);

                if (isset($key)) {
                    $key->forceFill(['resource_type' => $morph, 'resource_id' => $model->getKey()])->save();
                }

                ConsentLog::create([
                    'user_id' => $user?->id,
                    'email' => $email,
                    'purpose' => $purpose,
                    'policy_version' => (string) config('app.policy_version'),
                    'granted' => true,
                    'ip_hash' => $ipHash,
                ]);

                return $model;
            });
        } catch (UniqueConstraintViolationException $e) {
            // Envoi concurrent avec la même clé : l'autre requête a gagné, on renvoie sa ressource.
            $existing = $idempotencyKey === null ? null : $this->replay($user, $purpose, $morph, $idempotencyKey, $hash);
            if ($existing === null) {
                throw $e;
            }

            return [$existing, false];
        }

        $this->hit($purpose, $ip, $email);

        return [$model, true];
    }

    private function replay(?User $user, string $purpose, string $morph, string $key, string $hash): ?Model
    {
        $row = IdempotencyKey::query()
            ->where('scope', $purpose)->where('key', $key)
            ->when($user === null, fn ($q) => $q->whereNull('user_id'), fn ($q) => $q->where('user_id', $user?->id))
            ->first();

        if ($row === null) {
            return null;
        }

        if (! hash_equals($row->request_hash, $hash)) {
            throw ValidationException::withMessages([
                'idempotency_key' => ['Cette clé d\'idempotence a déjà été utilisée avec une demande différente.'],
            ]);
        }

        $class = Relation::getMorphedModel($morph);
        $model = $class === null || $row->resource_id === null ? null : $class::query()->find($row->resource_id);

        if ($model === null) {
            throw ValidationException::withMessages([
                'idempotency_key' => ['Cette clé d\'idempotence est déjà utilisée. Générez-en une nouvelle.'],
            ]);
        }

        return $model;
    }

    /** @param array<string, mixed> $data */
    private function requestHash(string $purpose, array $data): string
    {
        $this->ksortRecursive($data);

        return hash('sha256', $purpose.'|'.json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    }

    /** @param array<mixed> $array */
    private function ksortRecursive(array &$array): void
    {
        foreach ($array as &$value) {
            if (is_array($value)) {
                $this->ksortRecursive($value);
            }
        }
        unset($value);
        if (! array_is_list($array)) {
            ksort($array);
        }
    }

    private function assertWithinLimits(string $purpose, string $ip, ?string $email): void
    {
        foreach ($this->limits($purpose, $ip, $email) as [$key, $max]) {
            if (RateLimiter::tooManyAttempts($key, $max)) {
                throw new ApiHttpException(429, 'Trop de demandes envoyées. Veuillez réessayer plus tard.', [
                    'Retry-After' => (string) max(1, RateLimiter::availableIn($key)),
                ]);
            }
        }
    }

    private function hit(string $purpose, string $ip, ?string $email): void
    {
        foreach ($this->limits($purpose, $ip, $email) as [$key, , $decay]) {
            RateLimiter::hit($key, $decay);
        }
    }

    /** @return list<array{0: string, 1: int, 2: int}> [clé, maximum, durée en secondes] */
    private function limits(string $purpose, string $ip, ?string $email): array
    {
        $config = (array) config("public_forms.limits.{$purpose}");
        $limits = [["form-ip|{$purpose}|".sha1($ip), (int) ($config['ip_per_hour'] ?? 5), 3600]];
        if ($email !== null && $email !== '') {
            $limits[] = ["form-email|{$purpose}|".sha1(mb_strtolower($email)), (int) ($config['email_per_day'] ?? 10), 86400];
        }

        return $limits;
    }
}
