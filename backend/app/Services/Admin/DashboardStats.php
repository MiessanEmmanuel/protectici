<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
use App\Models\Feedback;
use App\Models\Provider;
use App\Models\QuoteRequest;
use App\Models\Review;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/** Compteurs du tableau de bord d'administration (fiches supprimées logiquement exclues). */
class DashboardStats
{
    /**
     * @return array<string, int>
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
            // Phase 3 vague B (contrat §8.5) : files de modération à traiter (éléments supprimés logiquement exclus).
            'pending_reviews' => Review::query()->where('status', 'pending')->count(),
            'open_review_reports' => DB::table('review_reports as rr')->join('reviews as r', 'r.id', '=', 'rr.review_id')->whereNull('r.deleted_at')->where('rr.status', 'open')->count(),
            'new_feedbacks' => Feedback::query()->where('status', 'new')->count(),
            'new_quote_requests' => QuoteRequest::query()->where('status', 'new')->count(),
            'new_contact_messages' => DB::table('contact_messages')->where('status', 'new')->count(),
        ];
    }

    /** @return Collection<int, AuditLog> */
    public function recentAudit(int $limit = 10): Collection
    {
        return AuditLog::query()->with('user:id,first_name,last_name')
            ->orderByDesc('id')->limit($limit)->get();
    }
}
