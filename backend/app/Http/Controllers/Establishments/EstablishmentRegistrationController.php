<?php

namespace App\Http\Controllers\Establishments;

use App\Enums\EstablishmentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Establishment\StoreEstablishmentRequest;
use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\User;
use App\Services\Establishments\RegisterEstablishment;
use Illuminate\Http\JsonResponse;

class EstablishmentRegistrationController extends Controller
{
    public function __invoke(StoreEstablishmentRequest $request, RegisterEstablishment $register): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $type = EstablishmentType::from($request->validated('type'));

        [$establishment] = $register->handle(
            $user,
            $type,
            $request->validated(),
            $request->idempotencyKey(),
            (string) $request->ip(),
        );

        $establishment->load(MyEstablishmentResource::relations($type));

        return (new MyEstablishmentResource($establishment))->response()->setStatusCode(201);
    }
}
