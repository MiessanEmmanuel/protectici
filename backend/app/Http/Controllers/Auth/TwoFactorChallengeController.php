<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\TwoFactorChallengeRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\AuthenticateUser;

class TwoFactorChallengeController extends Controller
{
    public function __invoke(TwoFactorChallengeRequest $request, AuthenticateUser $auth): UserResource
    {
        $code = $request->validated('code');
        $recovery = $request->validated('recovery_code');

        $user = $auth->challenge(
            $request,
            is_string($code) ? $code : null,
            is_string($recovery) ? $recovery : null,
        );

        return new UserResource($user);
    }
}
