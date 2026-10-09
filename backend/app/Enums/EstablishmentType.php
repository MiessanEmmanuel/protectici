<?php

namespace App\Enums;

use App\Models\Provider;
use App\Models\StateForce;
use Illuminate\Database\Eloquent\Builder;

/**
 * Type d'établissement (`{type}` des routes) : `provider` ou `state_force`. Valeurs = clés du morph map.
 */
enum EstablishmentType: string
{
    case Provider = 'provider';
    case StateForce = 'state_force';

    /** @return class-string<Provider|StateForce> */
    public function modelClass(): string
    {
        return match ($this) {
            self::Provider => Provider::class,
            self::StateForce => StateForce::class,
        };
    }

    /** @return Builder<Provider>|Builder<StateForce> */
    public function query(): Builder
    {
        return $this->modelClass()::query();
    }

    public function table(): string
    {
        return match ($this) {
            self::Provider => 'providers',
            self::StateForce => 'state_forces',
        };
    }

    /** Colonne de rattachement des justificatifs / demandes de modification. */
    public function foreignKey(): string
    {
        return match ($this) {
            self::Provider => 'provider_id',
            self::StateForce => 'state_force_id',
        };
    }

    public static function tryFromModel(Provider|StateForce $model): self
    {
        return $model instanceof Provider ? self::Provider : self::StateForce;
    }

    /** Routes de paramètres : accepte uniquement les deux valeurs (sinon null => 404). */
    public static function fromRoute(string $value): ?self
    {
        return self::tryFrom($value);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $t) => $t->value, self::cases());
    }
}
