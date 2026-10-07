<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Services\Auth\PasswordResetService;
use Illuminate\Http\JsonResponse;

class PasswordResetLinkController extends Controller
{
    public function __invoke(ForgotPasswordRequest $request, PasswordResetService $service): JsonResponse
    {
        $service->sendResetLink((string) $request->validated('email'));

        // Réponse strictement identique que le compte existe ou non.
        return response()->json(['message' => __('passwords.sent')]);
    }
}
