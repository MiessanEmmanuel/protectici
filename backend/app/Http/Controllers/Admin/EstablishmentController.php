<?php

namespace App\Http\Controllers\Admin;

use App\Enums\EstablishmentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Establishment\AdminUpdateEstablishmentRequest;
use App\Http\Requests\Establishment\DeleteEstablishmentRequest;
use App\Http\Requests\Establishment\ListAdminEstablishmentsRequest;
use App\Http\Requests\Establishment\ReasonRequest;
use App\Http\Resources\Establishments\AdminEstablishmentResource;
use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use App\Services\Establishments\EstablishmentModeration;
use App\Services\Establishments\EstablishmentQueries;
use App\Services\Establishments\EstablishmentWriter;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class EstablishmentController extends Controller
{
    public function index(ListAdminEstablishmentsRequest $request, EstablishmentQueries $queries): JsonResponse
    {
        $v = $request->validated();

        return response()->json($queries->admin([
            'type' => $v['type'] ?? null, 'status' => $v['status'] ?? null,
            'q' => isset($v['q']) ? trim($v['q']) : null, 'sort' => $v['sort'] ?? null,
        ], $request->perPage()));
    }

    public function show(string $type, int $id): AdminEstablishmentResource
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('moderate', $establishment);

        return $this->resource($establishment);
    }

    public function update(AdminUpdateEstablishmentRequest $request, string $type, int $id, EstablishmentWriter $writer): AdminEstablishmentResource
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('updateSensitive', $establishment);

        $writer->updateByAdmin($establishment, $request->validated());

        return $this->resource($establishment);
    }

    public function approve(Request $request, string $type, int $id, EstablishmentModeration $moderation): AdminEstablishmentResource
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('approve', $establishment);
        $moderation->approve($establishment, $this->admin($request));

        return $this->resource($establishment);
    }

    public function reject(ReasonRequest $request, string $type, int $id, EstablishmentModeration $moderation): AdminEstablishmentResource
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('approve', $establishment);
        $moderation->reject($establishment, $this->admin($request), $request->validated('reason'));

        return $this->resource($establishment);
    }

    public function suspend(ReasonRequest $request, string $type, int $id, EstablishmentModeration $moderation): AdminEstablishmentResource
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('moderate', $establishment);
        $moderation->suspend($establishment, $this->admin($request), $request->validated('reason'));

        return $this->resource($establishment);
    }

    public function restore(Request $request, string $type, int $id, EstablishmentModeration $moderation): AdminEstablishmentResource
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('moderate', $establishment);
        $moderation->restore($establishment, $this->admin($request));

        return $this->resource($establishment);
    }

    public function verify(string $type, int $id, EstablishmentModeration $moderation): AdminEstablishmentResource
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('moderate', $establishment);
        $moderation->setVerified($establishment, true);

        return $this->resource($establishment);
    }

    public function unverify(string $type, int $id, EstablishmentModeration $moderation): AdminEstablishmentResource
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('moderate', $establishment);
        $moderation->setVerified($establishment, false);

        return $this->resource($establishment);
    }

    public function destroy(DeleteEstablishmentRequest $request, string $type, int $id, EstablishmentModeration $moderation): Response
    {
        $establishment = $this->find($type, $id);
        Gate::authorize('delete', $establishment);
        $moderation->delete($establishment, $request->validated('confirm_name'));

        return response()->noContent();
    }

    private function admin(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    private function find(string $type, int $id): Provider|StateForce
    {
        $kind = EstablishmentType::tryFrom($type) ?? throw new ModelNotFoundException;

        return $kind->query()->findOrFail($id);
    }

    private function resource(Provider|StateForce $establishment): AdminEstablishmentResource
    {
        $kind = EstablishmentType::tryFromModel($establishment);
        $fresh = $kind->query()->whereKey($establishment->getKey())->with(MyEstablishmentResource::relations($kind))->firstOrFail();

        return new AdminEstablishmentResource($fresh);
    }
}
