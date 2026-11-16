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
 * Vérification d'email par lien signé. Jamais d'exception : tout lien invalide, expiré ou visant un compte
 * inexistant donne le même résultat INVALID. Seul un lien authentique (signature et empreinte valides) déjà
 * utilisé donne ALREADY_VERIFIED : il ne renseigne que le titulaire du lien, et lui évite un message trompeur.
 */
class EmailVerification
{
    public const VERIFIED = 'verified';

    public const ALREADY_VERIFIED = 'already_verified';

    public const INVALID = 'invalid';

    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Vérifie l'e-mail (usage unique) et ouvre la session. VERIFIED seulement si le lien a été consommé maintenant ;
     * ALREADY_VERIFIED pour un lien authentique rejoué (aucune session ouverte) ; INVALID dans tous les autres cas.
     *
     * @return self::VERIFIED|self::ALREADY_VERIFIED|self::INVALID
     */
    public function verify(Request $request, string $id, string $hash): string
    {
        if (! URL::hasValidSignature($request) || ! ctype_digit($id) || strlen($id) > 18) {
            return self::INVALID;
        }

        /** @var User|null $user */
        $user = User::query()->find((int) $id);

        if ($user === null || ! $user->is_active || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return self::INVALID;
        }

        if ($user->hasVerifiedEmail()) {
            return self::ALREADY_VERIFIED;
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

        return self::VERIFIED;
    }

    public function resend(User $user): void
    {
        if (! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }
    }

    /**
     * URL de retour vers le front, construite uniquement depuis la configuration. Lien déjà utilisé : page de
     * connexion avec « Adresse e-mail confirmée. Vous pouvez vous connecter. » (et non « lien invalide »).
     */
    public function redirectUrl(string $result): string
    {
        $front = rtrim((string) config('auth.frontend_url'), '/');

        return match ($result) {
            self::VERIFIED => $front.'/compte?verified=1',
            self::ALREADY_VERIFIED => $front.'/connexion?verified=1',
            default => $front.'/connexion?verified=0',
        };
    }
}
