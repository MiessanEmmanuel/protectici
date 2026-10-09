<?php

namespace App\Services\Establishments;

use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/** Listes d'établissements (prestataires + forces étatiques) par UNION, paginées côté base. */
class EstablishmentQueries
{
    /** @return array<string, mixed> enveloppe de pagination du contrat §1 */
    public function mine(User $user, int $perPage): array
    {
        $page = $this->union()
            ->where('e.user_id', $user->id)
            ->orderByDesc('e.submitted_at')->orderByDesc('e.id')
            ->paginate($perPage);

        return $this->envelope($page, fn (object $r): array => [
            'type' => $r->type,
            'slug' => $r->slug,
            'name' => $r->name,
            'status' => $r->status,
            'rejection_reason' => $r->rejection_reason,
            'is_visible' => (bool) $r->is_visible,
            'is_verified' => (bool) $r->is_verified,
            'submitted_at' => $this->iso($r->submitted_at),
            'reviewed_at' => $this->iso($r->reviewed_at),
            'pending_change_requests' => (int) $r->pending_change_requests,
        ]);
    }

    /**
     * @param  array{type?: string|null, status?: string|null, q?: string|null, sort?: string|null}  $filters
     * @return array<string, mixed>
     */
    public function admin(array $filters, int $perPage): array
    {
        $query = $this->union();

        if (! empty($filters['type'])) {
            $query->where('e.type', $filters['type']);
        }
        if (! empty($filters['status'])) {
            $query->where('e.status', $filters['status']);
        }
        if (! empty($filters['q'])) {
            $term = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $filters['q']).'%';
            $query->whereRaw('e.name ILIKE ?', [$term]);
        }

        ($filters['sort'] ?? '-submitted_at') === 'name'
            ? $query->orderBy('e.name')->orderBy('e.id')
            : $query->orderByDesc('e.submitted_at')->orderByDesc('e.id');

        $page = $query
            ->leftJoin('cities as c', 'c.id', '=', 'e.city_id')
            ->leftJoin('users as u', 'u.id', '=', 'e.user_id')
            ->select('e.*', 'c.name as city_name', 'u.first_name as owner_first', 'u.last_name as owner_last', 'u.email as owner_email')
            ->paginate($perPage);

        return $this->envelope($page, fn (object $r): array => [
            'type' => $r->type,
            'id' => (int) $r->id,
            'slug' => $r->slug,
            'name' => $r->name,
            'status' => $r->status,
            'is_visible' => (bool) $r->is_visible,
            'is_verified' => (bool) $r->is_verified,
            'is_featured' => (bool) $r->is_featured,
            'city' => ['name' => $r->city_name],
            'owner' => $r->user_id === null ? null : [
                'id' => (int) $r->user_id,
                'name' => trim($r->owner_first.' '.$r->owner_last),
                'email' => $r->owner_email,
            ],
            'submitted_at' => $this->iso($r->submitted_at),
            'reviewed_at' => $this->iso($r->reviewed_at),
        ]);
    }

    private function union(): Builder
    {
        $providers = DB::table('providers')->whereNull('deleted_at')->selectRaw(
            "'provider' as type, id, user_id, slug, name, status, rejection_reason, is_visible, is_verified, is_featured, city_id, created_at as submitted_at, reviewed_at, "
            ."(select count(*) from provider_change_requests cr where cr.provider_id = providers.id and cr.status = 'pending') as pending_change_requests"
        );
        $forces = DB::table('state_forces')->whereNull('deleted_at')->selectRaw(
            "'state_force' as type, id, user_id, slug, name, status, rejection_reason, is_visible, false as is_verified, false as is_featured, city_id, created_at as submitted_at, reviewed_at, "
            ."(select count(*) from provider_change_requests cr where cr.state_force_id = state_forces.id and cr.status = 'pending') as pending_change_requests"
        );

        return DB::query()->fromSub($providers->unionAll($forces), 'e');
    }

    /**
     * @param  LengthAwarePaginator<int, mixed>  $page
     * @param  callable(object): array<string, mixed>  $map
     * @return array<string, mixed>
     */
    private function envelope(LengthAwarePaginator $page, callable $map): array
    {
        return [
            'data' => collect($page->items())->map($map)->values()->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()],
        ];
    }

    private function iso(mixed $value): ?string
    {
        return $value === null ? null : MyEstablishmentResource::isoStatic(new \DateTimeImmutable((string) $value));
    }
}
