<?php

namespace App\Http\Controllers\Establishments;

use App\Enums\EstablishmentType;
use App\Http\Controllers\Controller;
use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;

/**
 * Base des contrôleurs de l'espace prestataire. Un établissement n'est résolu que s'il appartient à
 * l'utilisateur connecté ET n'est pas supprimé : sinon 404 (jamais 403, pour ne pas révéler son existence).
 */
abstract class OwnerController extends Controller
{
    protected function owned(Request $request, string $type, string $slug): Provider|StateForce
    {
        $kind = EstablishmentType::tryFrom($type) ?? throw new ModelNotFoundException;
        /** @var User $user */
        $user = $request->user();

        return $kind->query()
            ->where('user_id', $user->id)
            ->where('slug', $slug)
            ->with(MyEstablishmentResource::relations($kind))
            ->firstOrFail();
    }

    protected function resource(Provider|StateForce $establishment): MyEstablishmentResource
    {
        $kind = EstablishmentType::tryFromModel($establishment);
        $fresh = $kind->query()->whereKey($establishment->getKey())->with(MyEstablishmentResource::relations($kind))->firstOrFail();

        return new MyEstablishmentResource($fresh);
    }
}
