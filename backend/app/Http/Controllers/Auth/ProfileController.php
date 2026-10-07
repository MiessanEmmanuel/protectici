<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Auth\UpdateProfile;

class ProfileController extends Controller
{
    public function __invoke(UpdateProfileRequest $request, UpdateProfile $profile): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        /** @var array{first_name?: string, last_name?: string, phone?: string|null} $data */
        $data = $request->safe()->only(['first_name', 'last_name', 'phone']);

        return new UserResource($profile->handle($user, $data));
    }
}
