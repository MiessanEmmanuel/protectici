<?php

namespace App\Http\Controllers\Establishments;

use App\Enums\EstablishmentType;
use App\Http\Requests\Establishment\ChangeRequestRequest;
use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\ProviderChangeRequest;
use App\Models\User;
use App\Services\Establishments\ChangeRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class ChangeRequestController extends OwnerController
{
    public function store(ChangeRequestRequest $request, string $type, string $slug, ChangeRequests $service): JsonResponse
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('requestChange', $establishment);

        /** @var User $user */
        $user = $request->user();
        $created = $service->create($establishment, $user, $request->validated('changes'));

        return response()->json(['data' => MyEstablishmentResource::changeRequest($created)], 201);
    }

    public function destroy(Request $request, string $type, string $slug, int $id, ChangeRequests $service): Response
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('updateOwn', $establishment);

        $changeRequest = ProviderChangeRequest::query()
            ->where(EstablishmentType::tryFromModel($establishment)->foreignKey(), $establishment->getKey())
            ->findOrFail($id);

        $service->cancel($establishment, $changeRequest);

        return response()->noContent();
    }
}
