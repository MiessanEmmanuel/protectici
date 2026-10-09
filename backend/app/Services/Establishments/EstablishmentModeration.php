<?php

namespace App\Services\Establishments;

use App\Exceptions\ApiHttpException;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Actions de modération, IDEMPOTENTES : rejouer une action déjà appliquée ne change rien, n'écrit pas d'audit
 * et n'envoie pas d'e-mail. Chaque transition réelle est journalisée et notifiée une seule fois (après transaction).
 */
class EstablishmentModeration
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly EstablishmentNotifier $notifier,
    ) {}

    public function approve(Provider|StateForce $establishment, User $admin): Provider|StateForce
    {
        [$model, $done] = $this->transition($establishment, function (Provider|StateForce $m) use ($admin): bool {
            if ($m->status === 'approved') {
                return false;
            }
            if (! in_array($m->status, ['draft', 'pending', 'rejected'], true)) {
                throw new ApiHttpException(409, 'Cette fiche est suspendue : utilisez la restauration.');
            }

            $old = ['status' => $m->status, 'is_visible' => (bool) $m->is_visible];
            $m->forceFill([
                'status' => 'approved', 'is_visible' => true, 'rejection_reason' => null,
                'reviewed_by' => $admin->id, 'reviewed_at' => now(),
            ])->save();

            // Première approbation : le propriétaire devient « provider » (jamais de rétrogradation d'un editor/admin).
            if ($m->user_id !== null) {
                $owner = User::query()->lockForUpdate()->find($m->user_id);
                if ($owner instanceof User && $owner->role === User::ROLE_USER) {
                    $owner->forceFill(['role' => User::ROLE_PROVIDER])->save(); // audit role_changed via UserObserver
                }
            }

            $this->audit->record('establishment_approved', $m, $old, ['status' => 'approved', 'is_visible' => true]);

            return true;
        });

        if ($done) {
            $this->notifier->approved($model);
        }

        return $model;
    }

    public function reject(Provider|StateForce $establishment, User $admin, string $reason): Provider|StateForce
    {
        [$model, $done] = $this->transition($establishment, function (Provider|StateForce $m) use ($admin, $reason): bool {
            if ($m->status === 'rejected') {
                return false;
            }
            if (! in_array($m->status, ['draft', 'pending'], true)) {
                throw new ApiHttpException(409, 'Seule une fiche en attente peut être rejetée (utilisez la suspension pour une fiche publiée).');
            }

            $old = ['status' => $m->status];
            $m->forceFill([
                'status' => 'rejected', 'is_visible' => false, 'rejection_reason' => $reason,
                'reviewed_by' => $admin->id, 'reviewed_at' => now(),
            ])->save();
            $this->audit->record('establishment_rejected', $m, $old, ['status' => 'rejected']);

            return true;
        });

        if ($done) {
            $this->notifier->rejected($model, $reason);
        }

        return $model;
    }

    /** Le motif de suspension est conservé dans `rejection_reason` (affiché au propriétaire). */
    public function suspend(Provider|StateForce $establishment, User $admin, string $reason): Provider|StateForce
    {
        [$model, $done] = $this->transition($establishment, function (Provider|StateForce $m) use ($admin, $reason): bool {
            if ($m->status === 'suspended') {
                return false;
            }
            if ($m->status !== 'approved') {
                throw new ApiHttpException(409, 'Seule une fiche validée peut être suspendue.');
            }

            $m->forceFill([
                'status' => 'suspended', 'is_visible' => false, 'rejection_reason' => $reason,
                'reviewed_by' => $admin->id, 'reviewed_at' => now(),
            ])->save();
            $this->audit->record('establishment_suspended', $m, ['status' => 'approved'], ['status' => 'suspended']);

            return true;
        });

        if ($done) {
            $this->notifier->suspended($model, $reason);
        }

        return $model;
    }

    public function restore(Provider|StateForce $establishment, User $admin): Provider|StateForce
    {
        return $this->transition($establishment, function (Provider|StateForce $m) use ($admin): bool {
            if ($m->status === 'approved') {
                return false;
            }
            if ($m->status !== 'suspended') {
                throw new ApiHttpException(409, 'Seule une fiche suspendue peut être restaurée.');
            }

            $m->forceFill([
                'status' => 'approved', 'is_visible' => true, 'rejection_reason' => null,
                'reviewed_by' => $admin->id, 'reviewed_at' => now(),
            ])->save();
            $this->audit->record('establishment_restored', $m, ['status' => 'suspended'], ['status' => 'approved']);

            return true;
        })[0];
    }

    public function setVerified(Provider|StateForce $establishment, bool $verified): Provider|StateForce
    {
        if (! $establishment instanceof Provider) {
            throw new ApiHttpException(422, 'La vérification ne concerne que les prestataires.');
        }

        return $this->transition($establishment, function (Provider|StateForce $m) use ($verified): bool {
            /** @var Provider $m */
            if ($m->is_verified === $verified) {
                return false;
            }
            $m->forceFill(['is_verified' => $verified, 'verified_at' => $verified ? now() : null])->save();
            $this->audit->record($verified ? 'establishment_verified' : 'establishment_unverified', $m);

            return true;
        })[0];
    }

    /** Suppression logique, après confirmation du nom exact. */
    public function delete(Provider|StateForce $establishment, string $confirmName): void
    {
        if (trim($confirmName) !== $establishment->name) {
            throw ValidationException::withMessages(['confirm_name' => ['Le nom saisi ne correspond pas au nom exact de la fiche.']]);
        }

        DB::transaction(function () use ($establishment) {
            $establishment->forceFill(['is_visible' => false])->save();
            $establishment->delete();
            $this->audit->record('establishment_deleted', $establishment, ['status' => $establishment->status], null);
        });
    }

    /**
     * Exécute $apply sur la ligne verrouillée ; retourne [fiche rafraîchie, transition réelle ?].
     *
     * @param  callable(Provider|StateForce): bool  $apply
     * @return array{0: Provider|StateForce, 1: bool}
     */
    private function transition(Provider|StateForce $establishment, callable $apply): array
    {
        return DB::transaction(function () use ($establishment, $apply) {
            $locked = $establishment::query()->whereKey($establishment->getKey())->lockForUpdate()->firstOrFail();
            $changed = $apply($locked);

            return [$locked, $changed];
        });
    }
}
