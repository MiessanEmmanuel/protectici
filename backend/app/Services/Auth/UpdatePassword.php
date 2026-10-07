<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Changement de mot de passe (utilisateur connecté) : les autres sessions sont fermées,
 * la session courante est régénérée et conservée.
 */
class UpdatePassword
{
    public function __construct(
        private readonly SessionInvalidator $sessions,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Request $request, User $user, #[\SensitiveParameter] string $password): void
    {
        $guard = Auth::guard('web');
        $hadRememberCookie = $request->cookies->has($guard->getRecallerName());

        $user->forceFill(['password' => $password])->save();

        $session = $request->session();
        $this->sessions->destroyOthers($user, $session->getId());

        // Session courante : nouvel identifiant ; cookie « se souvenir de moi » réémis si présent.
        $guard->login($user, $hadRememberCookie && ! $user->isStaff());
        $session->regenerate();

        $this->audit->record('password_changed', $user, actor: $user);
    }
}
