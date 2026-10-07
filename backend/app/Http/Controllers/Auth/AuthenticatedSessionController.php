<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\AuthenticateUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request, AuthenticateUser $auth): JsonResponse|UserResource
    {
        $user = $auth->login(
            $request,
            (string) $request->validated('email'),
            (string) $request->validated('password'),
            $request->boolean('remember'),
        );

        if ($user === null) {
            return response()->json(['two_factor' => true]);
        }

        return new UserResource($user);
    }

    public function destroy(Request $request): Response
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
