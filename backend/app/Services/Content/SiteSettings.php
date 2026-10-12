<?php

namespace App\Services\Content;

use App\Models\Setting;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/** Paramètres du site : clés en liste blanche, exposition publique explicite (`is_public`), audit à chaque changement. */
class SiteSettings
{
    /** Clés modifiables. Toute autre clé est refusée (validation) et ne peut donc jamais être créée via l'API. */
    public const KEYS = [
        'contact.phone', 'contact.email', 'site.name', 'site.address', 'site.tagline',
        'social.facebook', 'social.twitter', 'social.linkedin', 'social.instagram', 'social.youtube', 'social.tiktok', 'social.whatsapp',
    ];

    public function __construct(private readonly AuditLogger $audit) {}

    /** @return array<string, mixed> clés publiques => valeur */
    public function publicMap(): array
    {
        $out = [];
        foreach (Setting::query()->where('is_public', true)->whereIn('key', self::KEYS)->orderBy('key')->get() as $setting) {
            $out[$setting->key] = $setting->value;
        }

        return $out;
    }

    /**
     * @param  list<array{key: string, value: mixed, is_public?: bool}>  $items
     * @return list<Setting>
     */
    public function save(User $actor, array $items): array
    {
        return DB::transaction(function () use ($actor, $items) {
            $saved = [];
            foreach ($items as $item) {
                $setting = Setting::query()->whereKey($item['key'])->lockForUpdate()->first() ?? new Setting(['key' => $item['key']]);
                $old = $setting->exists ? ['value' => $setting->value, 'is_public' => $setting->is_public] : null;

                $setting->forceFill([
                    'key' => $item['key'],
                    'value' => $item['value'] ?? '',
                    'is_public' => array_key_exists('is_public', $item) ? (bool) $item['is_public'] : ($setting->exists ? $setting->is_public : true),
                    'updated_by' => $actor->id,
                ])->save();

                // auditable_id est numérique : la clé (chaîne) est portée par le contexte.
                $this->audit->record('setting_updated', null, $old, ['value' => $setting->value, 'is_public' => $setting->is_public], ['key' => $setting->key], $actor);
                $saved[] = $setting;
            }

            return $saved;
        });
    }
}
