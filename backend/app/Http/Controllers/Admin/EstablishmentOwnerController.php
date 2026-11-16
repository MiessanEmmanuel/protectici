<?php

namespace App\Http\Controllers\Admin;

use App\Enums\EstablishmentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Claims\AssignOwnerRequest;
use App\Http\Resources\Establishments\AdminEstablishmentResource;
use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\User;
use App\Services\Claims\ClaimService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Gate;

/** « Attribuer à un compte » (contrat §10.3) : rattachement direct d'une fiche par l'e-mail d'un compte actif. */
class EstablishmentOwnerController extends Controller
{
    public function __invoke(AssignOwnerRequest $request, string $type, int $id, ClaimService $claims): AdminEstablishmentResource
    {
        $kind = EstablishmentType::tryFrom($type) ?? throw new ModelNotFoundException;
        $establishment = $kind->query()->findOrFail($id);
        Gate::authorize('moderate', $establishment);

        /** @var User $admin */
        $admin = $request->user();
        $claims->assignOwner($establishment, (string) $request->validated('email'), $admin);

        $fresh = $kind->query()->whereKey($establishment->getKey())->with(MyEstablishmentResource::relations($kind))->firstOrFail();

        return new AdminEstablishmentResource($fresh);
    }
}
