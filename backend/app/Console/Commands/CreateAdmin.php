<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Rules\StrongPassword;
use App\Services\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Création du premier administrateur (modele.md §7.3, security.md §12).
 * Toutes les valeurs sont saisies de façon interactive (mot de passe masqué) : jamais en argument
 * ni en option, donc jamais dans l'historique du shell. La 2FA sera exigée au premier accès admin.
 */
class CreateAdmin extends Command
{
    protected $signature = 'app:create-admin';

    protected $description = 'Crée un compte administrateur (saisie interactive, mot de passe masqué)';

    public function handle(AuditLogger $audit): int
    {
        $firstName = trim((string) $this->ask('Prénom'));
        $lastName = trim((string) $this->ask('Nom'));
        $email = Str::lower(trim((string) $this->ask('Adresse e-mail')));
        $password = (string) $this->secret('Mot de passe (12 caractères minimum)');
        $confirmation = (string) $this->secret('Confirmez le mot de passe');

        $validator = Validator::make([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $confirmation,
        ], [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email:rfc,strict', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'confirmed', StrongPassword::forRole(User::ROLE_ADMIN)],
        ], [
            'email.unique' => 'Un compte existe déjà avec cette adresse e-mail.',
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $user = DB::transaction(function () use ($firstName, $lastName, $email, $password, $audit) {
            $user = new User([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'password' => $password,
            ]);
            $user->forceFill([
                'role' => User::ROLE_ADMIN,
                'is_active' => true,
                'email_verified_at' => now(),
            ])->save();

            $audit->record('admin_created', $user, context: ['source' => 'cli']);

            return $user;
        });

        $this->info("Administrateur créé (id {$user->getKey()}). La double authentification devra être activée à la première connexion.");

        return self::SUCCESS;
    }
}
