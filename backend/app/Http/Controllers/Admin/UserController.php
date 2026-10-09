<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AnonymizeUserRequest;
use App\Http\Requests\Admin\ListUsersRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Http\Resources\Admin\AdminUserCollection;
use App\Http\Resources\Admin\AdminUserResource;
use App\Models\User;
use App\Services\Admin\UserAdministration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    public function __construct(private readonly UserAdministration $users) {}

    public function index(ListUsersRequest $request): AdminUserCollection
    {
        Gate::authorize('viewAny', User::class);

        return new AdminUserCollection($this->users->paginate($request->filters()));
    }

    public function show(int $id): JsonResponse
    {
        $user = $this->users->find($id);
        Gate::authorize('view', $user);

        return response()->json(['data' => AdminUserResource::make($user)->resolve()]);
    }

    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        Gate::authorize('administer', $this->users->find($id));
        /** @var User $actor */
        $actor = $request->user();

        $user = $this->users->update($actor, $id, $request->changes());

        return response()->json(['data' => AdminUserResource::make($user)->resolve()]);
    }

    public function anonymize(AnonymizeUserRequest $request, int $id): Response
    {
        Gate::authorize('administer', $this->users->find($id));
        /** @var User $actor */
        $actor = $request->user();

        $this->users->anonymize($actor, $id, (string) $request->validated('confirm_email'));

        return response()->noContent();
    }
}
