<?php

namespace App\Services\Auth;

use App\Http\Middleware\StaffSessionInactivity;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\URL;

/**
 * Vérification d'email par lien signé. Retourne false (jamais d'exception) pour tout lien invalide,
 * expiré ou visant un compte inexistant : la redirection d'échec est identique dans tous les cas.
 */
class EmailVerification
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Vérifie l'e-mail (usage unique) et ouvre la session. Retourne true seulement si le lien a été consommé
     * maintenant ; false dans tous les autres cas (invalide, expiré, rejoué, compte désactivé), sans distinction.
     */
    public function verify(Request $request, string $id, string $hash): bool
    {
        if (! URL::hasValidSignature($request) || ! ctype_digit($id)) {
            return false;
        }

        /** @var User|null $user */
        $user = User::query()->find((int) $id);

        if ($user === null || ! $user->is_active || $user->hasVerifiedEmail()
            || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return false;
        }

        if ($user->markEmailAsVerified()) {
            event(new Verified($user));
            $this->audit->record('email_verified', $user, actor: $user);
        }

        // Connexion automatique, sauf admin/editor (login + 2FA obligatoires).
        if (! $user->isStaff()) {
            Auth::guard('web')->login($user);
            $request->session()->regenerate();
            $request->session()->put(StaffSessionInactivity::SESSION_KEY, now()->getTimestamp());
            $user->forceFill(['last_login_at' => now()])->saveQuietly();
            $this->audit->record('login_succeeded', $user, context: ['method' => 'email_verification'], actor: $user);
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
        $front = rtrim((string) config('auth.frontend_url'), '/');

        return $verified ? $front.'/compte?verified=1' : $front.'/connexion?verified=0';
    }
}
