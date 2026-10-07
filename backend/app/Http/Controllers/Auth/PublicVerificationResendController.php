<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ResendVerificationRequest;
use App\Services\Auth\VerificationMailer;
use Illuminate\Http\JsonResponse;

class PublicVerificationResendController extends Controller
{
    public const MESSAGE = "Si cette adresse correspond à un compte non confirmé, un nouvel e-mail vient d'être envoyé.";

    public function __invoke(ResendVerificationRequest $request, VerificationMailer $mailer): JsonResponse
    {
        $mailer->resendByEmail((string) $request->validated('email'), (string) $request->ip());

        return response()->json(['message' => self::MESSAGE], 202);
    }
}
