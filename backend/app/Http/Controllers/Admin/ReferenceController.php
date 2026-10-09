<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListReferenceRequest;
use App\Http\Requests\Admin\SaveReferenceRequest;
use App\Http\Resources\Admin\ReferenceCollection;
use App\Http\Resources\Admin\ReferenceResource;
use App\Models\User;
use App\Services\Admin\ReferenceAdministration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class ReferenceController extends Controller
{
    public function __construct(private readonly ReferenceAdministration $references) {}

    public function index(ListReferenceRequest $request, string $resource): ReferenceCollection
    {
        Gate::authorize('admin-area');

        return new ReferenceCollection($this->references->paginate(
            $resource,
            $request->filled('q') ? (string) $request->input('q') : null,
            (int) $request->input('per_page', 20),
        ));
    }

    public function store(SaveReferenceRequest $request, string $resource): JsonResponse
    {
        Gate::authorize('admin-area');

        $item = $this->references->create($this->actor($request), $resource, $request->payload());

        return response()->json(['data' => ReferenceResource::make($item)->resolve()], 201);
    }

    public function update(SaveReferenceRequest $request, string $resource, int $id): JsonResponse
    {
        Gate::authorize('admin-area');

        $item = $this->references->update($this->actor($request), $resource, $id, $request->payload());

        return response()->json(['data' => ReferenceResource::make($item)->resolve()]);
    }

    public function destroy(Request $request, string $resource, int $id): Response
    {
        Gate::authorize('admin-area');

        $this->references->delete($this->actor($request), $resource, $id);

        return response()->noContent();
    }

    private function actor(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
