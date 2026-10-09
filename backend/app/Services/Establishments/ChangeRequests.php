<?php

namespace App\Services\Establishments;

use App\Enums\EstablishmentType;
use App\Exceptions\ApiHttpException;
use App\Models\Provider;
use App\Models\ProviderChangeRequest;
use App\Models\StateForce;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\Establishments\EstablishmentSchema;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Demandes de modification des champs sensibles (RG2). Une seule `pending` par fiche (index unique partiel). */
class ChangeRequests
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly EstablishmentNotifier $notifier,
    ) {}

    /** @param array<string, mixed> $changes champ => nouvelle valeur (déjà validée) */
    public function create(Provider|StateForce $establishment, User $requester, array $changes): ProviderChangeRequest
    {
        $type = EstablishmentType::tryFromModel($establishment);
        $diff = [];
        foreach ($changes as $field => $new) {
            if (! in_array($field, EstablishmentSchema::sensitive($type), true)) {
                continue; // défense en profondeur : la requête a déjà filtré
            }
            $old = $establishment->getAttribute($field);
            if ((string) $old === (string) $new) {
                continue;
            }
            $diff[$field] = ['old' => $old, 'new' => $new];
        }

        if ($diff === []) {
            throw ValidationException::withMessages(['changes' => ['Aucune modification par rapport aux valeurs actuelles.']]);
        }

        try {
            $request = DB::transaction(function () use ($establishment, $requester, $type, $diff) {
                $request = (new ProviderChangeRequest)->fill([
                    $type->foreignKey() => $establishment->getKey(),
                    'requested_by' => $requester->id,
                    'changes' => $diff,
                ]);
                $request->save();
                $request->refresh();
                $this->audit->record('change_request_created', $establishment, null, null, ['fields' => array_keys($diff), 'change_request_id' => $request->id]);

                return $request;
            });
        } catch (UniqueConstraintViolationException) {
            throw new ApiHttpException(409, 'Une demande de modification est déjà en attente pour cette fiche.');
        }

        $this->notifier->changeRequestSubmitted($establishment);

        return $request;
    }

    public function cancel(Provider|StateForce $establishment, ProviderChangeRequest $request): void
    {
        DB::transaction(function () use ($establishment, $request) {
            $locked = ProviderChangeRequest::query()->whereKey($request->id)->lockForUpdate()->first();
            if ($locked === null || $locked->status !== 'pending') {
                throw new ApiHttpException(409, 'Cette demande ne peut plus être annulée.');
            }
            $locked->delete();
            $this->audit->record('change_request_cancelled', $establishment, null, null, ['change_request_id' => $request->id]);
        });
    }

    /** Applique les changements dans une transaction ; idempotent (déjà approuvée = sans effet ni e-mail). */
    public function approve(int $id, User $admin): ProviderChangeRequest
    {
        [$request, $establishment, $done] = DB::transaction(function () use ($id, $admin) {
            $request = ProviderChangeRequest::query()->lockForUpdate()->findOrFail($id);
            $establishment = $this->target($request);

            if ($request->status === 'approved') {
                return [$request, $establishment, false];
            }
            if ($request->status !== 'pending') {
                throw new ApiHttpException(409, 'Cette demande a déjà été traitée.');
            }

            $type = EstablishmentType::tryFromModel($establishment);
            $apply = [];
            foreach ($request->changes as $field => $change) {
                if (in_array($field, EstablishmentSchema::sensitive($type), true) && is_array($change) && array_key_exists('new', $change)) {
                    $apply[EstablishmentSchema::column($field)] = $change['new'];
                }
            }

            $establishment->forceFill($apply)->save();
            $request->forceFill(['status' => 'approved', 'reviewed_by' => $admin->id, 'reviewed_at' => now()])->save();
            $this->audit->record('change_request_approved', $establishment, null, null, ['fields' => array_keys($apply), 'change_request_id' => $request->id]);

            return [$request, $establishment, true];
        });

        if ($done) {
            $this->notifier->changeRequestApproved($establishment);
        }

        return $request;
    }

    public function reject(int $id, User $admin, string $reason): ProviderChangeRequest
    {
        [$request, $establishment, $done] = DB::transaction(function () use ($id, $admin, $reason) {
            $request = ProviderChangeRequest::query()->lockForUpdate()->findOrFail($id);
            $establishment = $this->target($request);

            if ($request->status === 'rejected') {
                return [$request, $establishment, false];
            }
            if ($request->status !== 'pending') {
                throw new ApiHttpException(409, 'Cette demande a déjà été traitée.');
            }

            $request->forceFill([
                'status' => 'rejected', 'rejection_reason' => $reason, 'reviewed_by' => $admin->id, 'reviewed_at' => now(),
            ])->save();
            $this->audit->record('change_request_rejected', $establishment, null, null, ['change_request_id' => $request->id]);

            return [$request, $establishment, true];
        });

        if ($done) {
            $this->notifier->changeRequestRejected($establishment, $reason);
        }

        return $request;
    }

    private function target(ProviderChangeRequest $request): Provider|StateForce
    {
        $model = $request->provider_id !== null
            ? Provider::query()->find($request->provider_id)
            : StateForce::query()->find($request->state_force_id);

        return $model ?? throw (new ModelNotFoundException);
    }
}
