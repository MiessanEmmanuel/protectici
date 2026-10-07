<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Écriture dans audit_logs (security.md §20). Ne reçoit JAMAIS de mot de passe ni de secret :
 * les clés sensibles sont retirées par sécurité avant écriture.
 */
class AuditLogger
{
    /** Clés (sous-chaînes) systématiquement retirées des valeurs journalisées. */
    private const SENSITIVE = ['password', 'secret', 'token', 'recovery', 'remember', 'authorization', 'cookie'];

    /**
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     * @param  array<string, mixed>|null  $context
     */
    public function record(
        string $event,
        ?Model $auditable = null,
        ?array $old = null,
        ?array $new = null,
        ?array $context = null,
        ?User $actor = null,
    ): AuditLog {
        $actor ??= Auth::user();

        return AuditLog::create([
            'user_id' => $actor?->getKey(),
            'event' => $event,
            'auditable_type' => $auditable?->getMorphClass(),
            'auditable_id' => $auditable?->getKey(),
            'old_values' => $old === null ? null : $this->scrub($old),
            'new_values' => $new === null ? null : $this->scrub($new),
            'context' => $context === null ? null : $this->scrub($context),
            'ip_address' => Request::ip(),
            'user_agent' => $this->userAgent(),
        ]);
    }

    private function userAgent(): ?string
    {
        $agent = Request::userAgent();

        return $agent === null ? null : mb_substr($agent, 0, 255);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
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
