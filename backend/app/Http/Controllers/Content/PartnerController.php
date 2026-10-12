<?php

namespace App\Http\Controllers\Content;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\SavePartnerRequest;
use App\Http\Resources\Content\BlogPresenter;
use App\Models\Partner;
use App\Models\User;
use App\Services\Content\EditorialAdministration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/** Partenaires et clients : administrateur uniquement (l'éditeur reçoit 403). */
class PartnerController extends Controller
{
    public function __construct(private readonly EditorialAdministration $admin) {}

    public function index(): JsonResponse
    {
        Gate::authorize('admin-area');
        $rows = Partner::query()->with('logo')->orderBy('type')->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['data' => $rows->map(fn (Partner $p) => $this->row($p))->all()]);
    }

    public function show(int $id): JsonResponse
    {
        Gate::authorize('admin-area');

        return response()->json(['data' => $this->row(Partner::query()->with('logo')->findOrFail($id))]);
    }

    public function store(SavePartnerRequest $request): JsonResponse
    {
        Gate::authorize('admin-area');
        $partner = $this->admin->savePartner($this->actor($request), new Partner, $request->validated());

        return response()->json(['data' => $this->row($partner->load('logo'))], 201);
    }

    public function update(SavePartnerRequest $request, int $id): JsonResponse
    {
        Gate::authorize('admin-area');
        $partner = $this->admin->savePartner($this->actor($request), Partner::query()->findOrFail($id), $request->validated());

        return response()->json(['data' => $this->row($partner->load('logo'))]);
    }

    public function destroy(Request $request, int $id): Response
    {
        Gate::authorize('admin-area');
        $this->admin->deletePartner($this->actor($request), Partner::query()->findOrFail($id));

        return response()->noContent();
    }

    /** @return array<string, mixed> */
    private function row(Partner $p): array
    {
        return BlogPresenter::partner($p) + ['sort_order' => $p->sort_order, 'is_visible' => $p->is_visible];
    }

    private function actor(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
