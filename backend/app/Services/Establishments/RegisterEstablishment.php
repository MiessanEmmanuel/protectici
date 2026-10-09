<?php

namespace App\Services\Establishments;

use App\Enums\EstablishmentType;
use App\Exceptions\ApiHttpException;
use App\Models\IdempotencyKey;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Inscription d'un établissement (contrat §7.2) :
 *  - idempotence par en-tête `Idempotency-Key` (même clé => même fiche, une seule ligne, aucun second e-mail) ;
 *  - limites 3 / jour / IP et 5 / jour / utilisateur, comptées uniquement sur les créations réelles
 *    (un rejeu idempotent ou une erreur de validation ne consomme pas le quota) ;
 *  - fiche `pending`, invisible, consentement tracé, accusé au demandeur et notification interne.
 */
class RegisterEstablishment
{
    public const SCOPE = 'establishment';

    public function __construct(
        private readonly EstablishmentWriter $writer,
        private readonly EstablishmentNotifier $notifier,
    ) {}

    /**
     * @param  array<string, mixed>  $data  données validées
     * @return array{0: Provider|StateForce, 1: bool} [fiche, créée maintenant ?]
     */
    public function handle(User $owner, EstablishmentType $type, array $data, ?string $idempotencyKey, string $ip): array
    {
        $hash = $this->requestHash($type, $data);

        if ($idempotencyKey !== null) {
            $existing = $this->replay($owner, $idempotencyKey, $hash);
            if ($existing !== null) {
                return [$existing, false];
            }
        }

        $this->assertWithinLimits($owner, $ip);

        try {
            $model = DB::transaction(function () use ($owner, $type, $data, $idempotencyKey, $hash, $ip) {
                if ($idempotencyKey !== null) {
                    // L'index unique (user, scope, key) sérialise deux envois simultanés avec la même clé.
                    $key = IdempotencyKey::create([
                        'user_id' => $owner->id,
                        'scope' => self::SCOPE,
                        'key' => $idempotencyKey,
                        'request_hash' => $hash,
                    ]);
                }

                $model = $this->writer->create($owner, $type, $data, $ip);

                if (isset($key)) {
                    $key->forceFill(['resource_type' => $model->getMorphClass(), 'resource_id' => $model->getKey()])->save();
                }

                return $model;
            });
        } catch (UniqueConstraintViolationException $e) {
            // Envoi concurrent avec la même clé : l'autre requête a gagné, on renvoie sa fiche.
            $existing = $idempotencyKey === null ? null : $this->replay($owner, $idempotencyKey, $hash);
            if ($existing === null) {
                throw $e;
            }

            return [$existing, false];
        }

        $this->hit($owner, $ip);
        $this->notifier->submitted($model, $owner);

        return [$model, true];
    }

    private function replay(User $owner, string $key, string $hash): Provider|StateForce|null
    {
        $row = IdempotencyKey::query()
            ->where('user_id', $owner->id)->where('scope', self::SCOPE)->where('key', $key)
            ->first();

        if ($row === null) {
            return null;
        }

        if (! hash_equals($row->request_hash, $hash)) {
            throw ValidationException::withMessages([
                'idempotency_key' => ['Cette clé d\'idempotence a déjà été utilisée avec une demande différente.'],
            ]);
        }

        $type = $row->resource_type === null ? null : EstablishmentType::tryFrom($row->resource_type);
        $model = $type?->query()->where('user_id', $owner->id)->whereKey($row->resource_id)->first();

        if ($model === null) {
            // Fiche supprimée entre-temps : la clé ne peut plus être rejouée.
            throw ValidationException::withMessages([
                'idempotency_key' => ['Cette clé d\'idempotence est déjà utilisée. Générez-en une nouvelle.'],
            ]);
        }

        return $model;
    }

    /** @param array<string, mixed> $data */
    private function requestHash(EstablishmentType $type, array $data): string
    {
        unset($data['turnstile_token']);
        $this->ksortRecursive($data);

        return hash('sha256', $type->value.'|'.json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
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

    private function assertWithinLimits(User $owner, string $ip): void
    {
        foreach ($this->limits($owner, $ip) as [$key, $max]) {
            if (RateLimiter::tooManyAttempts($key, $max)) {
                throw new ApiHttpException(429, 'Trop d\'inscriptions d\'établissement aujourd\'hui. Veuillez réessayer plus tard.', [
                    'Retry-After' => (string) max(1, RateLimiter::availableIn($key)),
                ]);
            }
        }
    }

    private function hit(User $owner, string $ip): void
    {
        foreach ($this->limits($owner, $ip) as [$key]) {
            RateLimiter::hit($key, 86400);
        }
    }

    /** @return list<array{0: string, 1: int}> */
    private function limits(User $owner, string $ip): array
    {
        return [
            ['establishment-submit-ip|'.sha1($ip), (int) config('establishments.submissions_per_ip_per_day', 3)],
            ['establishment-submit-user|'.$owner->id, (int) config('establishments.submissions_per_user_per_day', 5)],
        ];
    }
}
