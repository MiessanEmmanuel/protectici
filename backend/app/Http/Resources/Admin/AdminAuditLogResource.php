<?php

namespace App\Http\Resources\Admin;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AdminAuditLog du contrat. La relation `user` doit être chargée (eager loading). Les valeurs sont filtrées
 * une seconde fois par sécurité (AuditLogger le fait déjà à l'écriture) ; ni contexte ni user-agent exposés.
 *
 * @mixin AuditLog
 */
class AdminAuditLogResource extends JsonResource
{
    private const SENSITIVE = ['password', 'secret', 'token', 'recovery', 'remember', 'authorization', 'cookie'];

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var AuditLog $log */
        $log = $this->resource;
        $user = $log->user;

        return [
            'id' => $log->id,
            'event' => $log->event,
            'user' => $user === null ? null : [
                'id' => $user->id,
                'name' => trim($user->first_name.' '.$user->last_name),
            ],
            'auditable_type' => $log->auditable_type,
            'auditable_id' => $log->auditable_id,
            'old_values' => is_array($log->old_values) ? $this->scrub($log->old_values) : null,
            'new_values' => is_array($log->new_values) ? $this->scrub($log->new_values) : null,
            'ip_address' => $log->ip_address,
            'created_at' => $log->created_at?->toImmutable()->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }

    /**
     * @param  array<array-key, mixed>  $values
     * @return array<array-key, mixed>
     */
    private function scrub(array $values): array
    {
        $clean = [];
        foreach ($values as $key => $value) {
            $lower = strtolower((string) $key);
            foreach (self::SENSITIVE as $needle) {
                if (str_contains($lower, $needle)) {
                    continue 2;
                }
            }
            $clean[$key] = is_array($value) ? $this->scrub($value) : $value;
        }

        return $clean;
    }
}
