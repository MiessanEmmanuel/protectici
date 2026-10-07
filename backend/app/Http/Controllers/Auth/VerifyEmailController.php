<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auth\EmailVerification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class VerifyEmailController extends Controller
{
    public function __invoke(Request $request, string $id, string $hash, EmailVerification $verification): RedirectResponse
    {
        $verified = $verification->verify($request, $id, $hash);

        // Destination fixe issue de la configuration : jamais de redirection ouverte.
        return redirect()->away($verification->redirectUrl($verified));
    }
}
