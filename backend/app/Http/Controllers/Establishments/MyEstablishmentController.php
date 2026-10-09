<?php

namespace App\Http\Controllers\Establishments;

use App\Enums\EstablishmentType;
use App\Http\Requests\Api\PaginationRequest;
use App\Http\Requests\Establishment\UpdateEstablishmentRequest;
use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Establishments\EstablishmentNotifier;
use App\Services\Establishments\EstablishmentQueries;
use App\Services\Establishments\EstablishmentWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class MyEstablishmentController extends OwnerController
{
    public function index(PaginationRequest $request, EstablishmentQueries $queries): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json($queries->mine($user, $request->perPage()));
    }

    public function show(Request $request, string $type, string $slug): MyEstablishmentResource
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('viewOwn', $establishment);

        return new MyEstablishmentResource($establishment);
    }

    public function update(UpdateEstablishmentRequest $request, string $type, string $slug, EstablishmentWriter $writer): MyEstablishmentResource
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('updateOwn', $establishment);

        $writer->updateByOwner($establishment, $request->validated());

        return $this->resource($establishment);
    }

    public function resubmit(Request $request, string $type, string $slug, AuditLogger $audit, EstablishmentNotifier $notifier): MyEstablishmentResource
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('resubmit', $establishment);

        DB::transaction(function () use ($establishment, $audit) {
            $locked = EstablishmentType::tryFromModel($establishment)->query()->whereKey($establishment->getKey())->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'rejected') {
                return;
            }
            $locked->forceFill(['status' => 'pending', 'is_visible' => false, 'rejection_reason' => null, 'reviewed_by' => null, 'reviewed_at' => null])->save();
            $audit->record('establishment_resubmitted', $locked, ['status' => 'rejected'], ['status' => 'pending']);
        });

        $notifier->resubmitted($establishment);

        return $this->resource($establishment);
    }
}
