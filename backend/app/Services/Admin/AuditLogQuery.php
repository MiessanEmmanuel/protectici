<?php

namespace App\Services\Admin;

use App\Models\AuditLog;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

/** Lecture du journal d'audit (lecture seule, plus récent d'abord). */
class AuditLogQuery
{
    /**
     * @param  array{event?: ?string, user_id?: ?int, auditable_type?: ?string, from?: ?string, to?: ?string, per_page?: ?int}  $filters
     * @return LengthAwarePaginator<int, AuditLog>
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = AuditLog::query()->with('user:id,first_name,last_name');

        if (filled($filters['event'] ?? null)) {
            $query->where('event', $filters['event']);
        }
        if (filled($filters['user_id'] ?? null)) {
            $query->where('user_id', (int) $filters['user_id']);
        }
        if (filled($filters['auditable_type'] ?? null)) {
            $query->where('auditable_type', $filters['auditable_type']);
        }
        if (filled($filters['from'] ?? null)) {
            $query->where('created_at', '>=', Carbon::parse((string) $filters['from']));
        }
        if (filled($filters['to'] ?? null)) {
            $to = (string) $filters['to'];
            // Date seule : la journée entière est incluse ; avec heure : borne incluse telle quelle.
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $to) === 1) {
                $query->where('created_at', '<', Carbon::parse($to)->addDay()->startOfDay());
            } else {
                $query->where('created_at', '<=', Carbon::parse($to));
            }
        }

        return $query->orderByDesc('id')
            ->paginate(min(50, max(1, (int) ($filters['per_page'] ?? 20))))
            ->withQueryString();
    }
}
