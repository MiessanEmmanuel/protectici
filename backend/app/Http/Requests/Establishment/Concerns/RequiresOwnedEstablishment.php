<?php

namespace App\Http\Requests\Establishment\Concerns;

use App\Enums\EstablishmentType;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * Les requêtes de l'espace prestataire vérifient la propriété AVANT la validation : un établissement d'autrui
 * répond 404 quelle que soit la charge utile (aucune fuite par les messages de validation).
 */
trait RequiresOwnedEstablishment
{
    public function authorize(): bool
    {
        $type = EstablishmentType::tryFrom((string) $this->route('type'));
        $user = $this->user();

        $owned = $type !== null && $user !== null
            && $type->query()->where('user_id', $user->id)->where('slug', (string) $this->route('slug'))->exists();

        if (! $owned) {
            throw new ModelNotFoundException;
        }

        return true;
    }
}
