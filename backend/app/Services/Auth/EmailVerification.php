<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

/**
 * Vérification d'email par lien signé. Retourne false (jamais d'exception) pour tout lien invalide,
 * expiré ou visant un compte inexistant : la redirection d'échec est identique dans tous les cas.
 */
class EmailVerification
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function verify(Request $request, string $id, string $hash): bool
    {
        if (! URL::hasValidSignature($request) || ! ctype_digit($id)) {
            return false;
        }

        /** @var User|null $user */
        $user = User::query()->find((int) $id);

        if ($user === null || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return false;
        }

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
            $this->audit->record('email_verified', $user, actor: $user);
        }

        return true;
    }

    public function resend(User $user): void
    {
        if (! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }
    }

    /** URL de retour vers le front, construite uniquement depuis la configuration. */
    public function redirectUrl(bool $verified): string
    {
        return config('auth.frontend_url').'/compte?verified='.($verified ? '1' : '0');
    }
}
