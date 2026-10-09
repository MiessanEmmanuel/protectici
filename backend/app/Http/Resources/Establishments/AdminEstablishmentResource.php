<?php

namespace App\Http\Resources\Establishments;

use App\Models\AuditLog;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;

/** AdminEstablishment (contrat §7.1) = MyEstablishment + propriétaire, mise en avant, vues, relecteur, audit (20). */
class AdminEstablishmentResource extends MyEstablishmentResource
{
    /** @return array<string, mixed> */
    protected function extra(Provider|StateForce $e): array
    {
        $owner = $e->user_id === null ? null : User::query()->find($e->user_id);
        $reviewer = $e->reviewed_by === null ? null : User::query()->find($e->reviewed_by);

        $audit = AuditLog::query()
            ->where('auditable_type', $e->getMorphClass())->where('auditable_id', $e->getKey())
            ->with('user')->latest('id')->limit(20)->get();

        return [
            'id' => $e->id,
            'owner' => $owner === null ? null : [
                'id' => $owner->id, 'first_name' => $owner->first_name, 'last_name' => $owner->last_name,
                'email' => $owner->email, 'phone' => $owner->phone,
            ],
            'is_featured' => $e instanceof Provider ? (bool) $e->is_featured : false,
            'views_count' => $e->views_count,
            'reviewed_by' => $reviewer === null ? null : ['id' => $reviewer->id, 'name' => $reviewer->first_name.' '.$reviewer->last_name],
            'audit' => $audit->map(fn (AuditLog $a) => [
                'event' => $a->event,
                'user' => $a->user === null ? null : ['name' => $a->user->first_name.' '.$a->user->last_name],
                'created_at' => self::isoStatic($a->created_at),
            ])->values(),
        ];
    }
}
