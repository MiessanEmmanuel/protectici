<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\EmailVerification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailVerificationNotificationController extends Controller
{
    public function __invoke(Request $request, EmailVerification $verification): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $verification->resend($user);

        return response()->json(['message' => __('auth.verification_sent')], 202);
    }
}
