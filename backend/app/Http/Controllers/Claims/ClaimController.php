<?php

namespace App\Http\Controllers\Claims;

use App\Enums\EstablishmentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Claims\SimilarEstablishmentsRequest;
use App\Http\Requests\Claims\StoreClaimRequest;
use App\Http\Resources\Claims\MyClaimResource;
use App\Models\EstablishmentClaim;
use App\Models\User;
use App\Services\Claims\ClaimService;
use App\Services\Claims\SimilarEstablishments;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Revendication d'une fiche par un compte connecté à l'e-mail vérifié (contrat §10.3). */
class ClaimController extends Controller
{
    public function store(StoreClaimRequest $request, string $type, string $slug, ClaimService $claims): JsonResponse
    {
        $kind = EstablishmentType::tryFrom($type) ?? throw new ModelNotFoundException;
        // Seules les fiches publiées se résolvent (sinon 404, même pour une fiche existante non publiée).
        $establishment = $kind->query()->published()->where('slug', $slug)->firstOrFail();
        Gate::authorize('create', [EstablishmentClaim::class, $establishment]);

        /** @var User $user */
        $user = $request->user();
        /** @var array{submitter_role: string, phone: string, message?: string|null} $data */
        $data = $request->safe()->only(['submitter_role', 'phone', 'message']);

        $claim = $claims->submit($user, $establishment, $data, $request->file('document'), $request->ip());

        return response()->json(['data' => (new MyClaimResource($claim))->resolve($request)], 201);
    }

    public function mine(Request $request, ClaimService $claims): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $rows = EstablishmentClaim::query()
            ->where('user_id', $user->id)
            ->with(ClaimService::relations())
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json(['data' => MyClaimResource::collection($rows)->resolve($request)]);
    }

    public function similar(SimilarEstablishmentsRequest $request, SimilarEstablishments $similar): JsonResponse
    {
        /** @var array{type: string, name: string, city_id?: int|null, phone?: string|null} $criteria */
        $criteria = $request->validated();

        return response()->json(['data' => $similar->find($criteria)]);
    }
}
