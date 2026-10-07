<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Services\Auth\PasswordResetService;
use Illuminate\Http\JsonResponse;

class NewPasswordController extends Controller
{
    public function __invoke(ResetPasswordRequest $request, PasswordResetService $service): JsonResponse
    {
        /** @var array{token: string, email: string, password: string} $data */
        $data = $request->safe()->only(['token', 'email', 'password']);

        $service->reset($data);

        return response()->json(['message' => __('passwords.reset')]);
    }
}
