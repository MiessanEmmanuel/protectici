<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PaginationRequest;
use App\Http\Requests\Establishment\ReasonRequest;
use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\Provider;
use App\Models\ProviderChangeRequest;
use App\Models\User;
use App\Services\Establishments\ChangeRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ChangeRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('admin-area');
        $v = $request->validate([
            'status' => ['nullable', 'string', Rule::in(['pending', 'approved', 'rejected'])],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ]);
        $perPage = max(1, min(PaginationRequest::MAX_PER_PAGE, (int) ($v['per_page'] ?? PaginationRequest::DEFAULT_PER_PAGE)));

        $page = ProviderChangeRequest::query()
            ->with(['provider', 'stateForce'])
            ->where('status', $v['status'] ?? 'pending')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => $page->getCollection()->map(fn (ProviderChangeRequest $c) => $this->row($c))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()],
        ]);
    }

    public function approve(Request $request, int $id, ChangeRequests $service): JsonResponse
    {
        Gate::authorize('admin-area');
        /** @var User $admin */
        $admin = $request->user();

        return $this->respond($service->approve($id, $admin));
    }

    public function reject(ReasonRequest $request, int $id, ChangeRequests $service): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        return $this->respond($service->reject($id, $admin, $request->validated('reason')));
    }

    private function respond(ProviderChangeRequest $changeRequest): JsonResponse
    {
        $changeRequest->load(['provider', 'stateForce']);

        return response()->json(['data' => $this->row($changeRequest)]);
    }

    /** @return array<string, mixed> */
    private function row(ProviderChangeRequest $c): array
    {
        $e = $c->establishment();

        return [
            'id' => $c->id,
            'type' => $e instanceof Provider ? 'provider' : 'state_force',
            'establishment' => $e === null ? null : ['id' => $e->id, 'name' => $e->name],
            'changes' => $c->changes,
            'status' => $c->status,
            'rejection_reason' => $c->rejection_reason,
            'created_at' => MyEstablishmentResource::isoStatic($c->created_at),
        ];
    }
}
