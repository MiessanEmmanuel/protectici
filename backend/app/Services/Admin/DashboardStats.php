<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/** Compteurs du tableau de bord d'administration (fiches supprimées logiquement exclues). */
class DashboardStats
{
    /**
     * @return array{pending_providers: int, pending_state_forces: int, pending_change_requests: int, users_total: int, providers_approved: int, state_forces_approved: int}
     */
    public function counters(): array
    {
        return [
            'pending_providers' => Provider::query()->where('status', 'pending')->count(),
            'pending_state_forces' => StateForce::query()->where('status', 'pending')->count(),
            // Demandes de modification : cible unique, prestataire XOR force étatique (contrainte en base).
            'pending_change_requests' => DB::table('provider_change_requests')->where('status', 'pending')->count(),
            'users_total' => User::query()->count(),
            'providers_approved' => Provider::query()->where('status', 'approved')->count(),
            'state_forces_approved' => StateForce::query()->where('status', 'approved')->count(),
        ];
    }

    /** @return Collection<int, AuditLog> */
    public function recentAudit(int $limit = 10): Collection
    {
        return AuditLog::query()->with('user:id,first_name,last_name')
            ->orderByDesc('id')->limit($limit)->get();
    }
}
