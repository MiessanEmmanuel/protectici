<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ConfirmTwoFactorRequest;
use App\Http\Requests\Auth\DisableTwoFactorRequest;
use App\Models\User;
use App\Services\Auth\TwoFactorAuthentication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class TwoFactorController extends Controller
{
    public function enable(Request $request, TwoFactorAuthentication $twoFactor): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        Gate::authorize('update', $user);

        return response()->json($twoFactor->enable($user));
    }

    public function confirm(ConfirmTwoFactorRequest $request, TwoFactorAuthentication $twoFactor): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        Gate::authorize('update', $user);

        $codes = $twoFactor->confirm($user, (string) $request->validated('code'));

        return response()->json(['recovery_codes' => $codes]);
    }

    public function disable(DisableTwoFactorRequest $request, TwoFactorAuthentication $twoFactor): Response
    {
        /** @var User $user */
        $user = $request->user();
        Gate::authorize('update', $user);

        $twoFactor->disable($user);

        return response()->noContent();
    }
}
