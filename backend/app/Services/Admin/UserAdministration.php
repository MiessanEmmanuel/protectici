<?php

namespace App\Services\Admin;

use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Auth\SessionInvalidator;
use App\Services\Directory\DirectoryFilters;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Gestion des comptes par l'administration (security.md §12-§13). `role` et `is_active` ne sont jamais
 * assignables en masse : ils sont écrits ici par forceFill, sous verrou transactionnel, après les gardes métier.
 * L'audit role_changed / account_status_changed est écrit par UserObserver (acteur = administrateur connecté).
 */
class UserAdministration
{
    public const ANONYMIZED_SUFFIX = '@anonymise.invalid';

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly SessionInvalidator $sessions,
    ) {}

    /**
     * Comptes avec le nombre d'établissements non supprimés (sous-requêtes : pas de chargement paresseux).
     *
     * @return Builder<User>
     */
    public function query(): Builder
    {
        return User::query()->selectRaw(
            'users.*, ('
            .'(SELECT count(*) FROM providers WHERE providers.user_id = users.id AND providers.deleted_at IS NULL)'
            .' + (SELECT count(*) FROM state_forces WHERE state_forces.user_id = users.id AND state_forces.deleted_at IS NULL)'
            .') AS establishments_count'
        );
    }

    /**
     * @param  array{q?: string|null, role?: string|null, is_active?: bool|null, sort?: string|null, per_page?: int|null}  $filters
     * @return LengthAwarePaginator<int, User>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = $this->query();

        if (filled($filters['q'] ?? null)) {
            $like = '%'.DirectoryFilters::escapeLike(trim((string) $filters['q'])).'%';
            $query->where(function (Builder $w) use ($like) {
                $w->whereRaw('users.first_name ILIKE ?', [$like])
                    ->orWhereRaw('users.last_name ILIKE ?', [$like])
                    ->orWhereRaw("(users.first_name || ' ' || users.last_name) ILIKE ?", [$like])
                    ->orWhereRaw('users.email::text ILIKE ?', [$like]);
            });
        }

        if (filled($filters['role'] ?? null)) {
            $query->where('users.role', $filters['role']);
        }

        if (($filters['is_active'] ?? null) !== null) {
            $query->where('users.is_active', (bool) $filters['is_active']);
        }

        $sort = $filters['sort'] ?? '-created_at';
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = ltrim($sort, '-');
        // Liste blanche des colonnes de tri.
        $query->orderBy('users.'.($column === 'last_name' ? 'last_name' : 'created_at'), $direction)
            ->orderBy('users.id', $direction);

        return $query->paginate(min(50, max(1, (int) ($filters['per_page'] ?? 12))))->withQueryString();
    }

    public function find(int $id): User
    {
        return $this->query()->findOrFail($id);
    }

    /**
     * @param  array{role?: string, is_active?: bool}  $data
     */
    public function update(User $actor, int $id, array $data): User
    {
        DB::transaction(function () use ($actor, $id, $data) {
            // Verrou sur tous les administrateurs actifs (évite que deux requêtes retirent en même temps les derniers).
            $adminIds = User::query()->where('role', User::ROLE_ADMIN)->where('is_active', true)
                ->orderBy('id')->lockForUpdate()->pluck('id')->all();
            $target = User::query()->lockForUpdate()->findOrFail($id);

            $newRole = $data['role'] ?? $target->role;
            $newActive = array_key_exists('is_active', $data) ? (bool) $data['is_active'] : $target->is_active;
            $roleChanges = $newRole !== $target->role;
            $statusChanges = $newActive !== $target->is_active;

            if (! $roleChanges && ! $statusChanges) {
                return;
            }

            $isSelf = $actor->is($target);
            $isActiveAdmin = $target->role === User::ROLE_ADMIN && $target->is_active;
            $losesAdmin = $isActiveAdmin && ($newRole !== User::ROLE_ADMIN || ! $newActive);

            if ($roleChanges && $isSelf) {
                $this->fail('role', 'Vous ne pouvez pas modifier votre propre rôle.');
            }
            if ($statusChanges && $isSelf) {
                $this->fail('is_active', 'Vous ne pouvez pas désactiver votre propre compte.');
            }
            if ($losesAdmin && count($adminIds) <= 1) {
                $this->fail($roleChanges ? 'role' : 'is_active', 'Impossible : il doit rester au moins un administrateur actif.');
            }
            if ($roleChanges && in_array($newRole, [User::ROLE_ADMIN, User::ROLE_EDITOR], true)) {
                if (! $newActive) {
                    $this->fail('role', 'Un compte désactivé ne peut pas recevoir ce rôle.');
                }
                if ($target->email_verified_at === null) {
                    $this->fail('role', 'L\'adresse e-mail de ce compte n\'est pas vérifiée.');
                }
            }

            $target->forceFill(['role' => $newRole, 'is_active' => $newActive])->save();

            if ($roleChanges) {
                $this->sessions->destroyAll($target);
            }
        });

        return $this->find($id);
    }

    /** Anonymisation RGPD irréversible (procédure SQL sp_anonymize_user). */
    public function anonymize(User $actor, int $id, string $confirmEmail): void
    {
        DB::transaction(function () use ($actor, $id, $confirmEmail) {
            $adminIds = User::query()->where('role', User::ROLE_ADMIN)->where('is_active', true)
                ->orderBy('id')->lockForUpdate()->pluck('id')->all();
            $target = User::query()->withTrashed()->lockForUpdate()->findOrFail($id);

            if (str_ends_with(mb_strtolower((string) $target->email), self::ANONYMIZED_SUFFIX)) {
                $this->fail('confirm_email', 'Ce compte est déjà anonymisé.');
            }
            if ($actor->is($target)) {
                $this->fail('confirm_email', 'Vous ne pouvez pas anonymiser votre propre compte.');
            }
            if ($target->role === User::ROLE_ADMIN && $target->is_active && count($adminIds) <= 1) {
                $this->fail('confirm_email', 'Impossible : il doit rester au moins un administrateur actif.');
            }
            if (mb_strtolower(trim($confirmEmail)) !== mb_strtolower((string) $target->email)) {
                $this->fail('confirm_email', 'L\'adresse e-mail saisie ne correspond pas à celle du compte.');
            }

            DB::statement('CALL sp_anonymize_user(?)', [$target->getKey()]);

            // Aucune adresse e-mail dans le journal : seulement l'identifiant (le compte est déjà anonymisé).
            $this->audit->record('user_anonymized_by_admin', $target, null, null, ['target_id' => $target->getKey()], $actor);
        });
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }
}
