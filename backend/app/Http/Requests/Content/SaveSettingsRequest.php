<?php

namespace App\Http\Requests\Content;

use App\Services\Content\SiteSettings;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `settings` : liste de {key, value, is_public?}. Les clés sont en liste blanche ; la règle de `value` dépend de la clé.
 */
class SaveSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [
            'settings' => ['required', 'array', 'min:1', 'max:'.count(SiteSettings::KEYS)],
            'settings.*' => ['array:key,value,is_public'],
            'settings.*.key' => ['required', 'string', Rule::in(SiteSettings::KEYS), 'distinct'],
            'settings.*.is_public' => ['sometimes', 'boolean'],
            'settings.*.value' => ['present', 'nullable', 'string', 'max:255'],
        ];

        foreach ((array) $this->input('settings', []) as $i => $item) {
            $key = is_array($item) ? ($item['key'] ?? null) : null;
            if ($key === 'contact.email') {
                $rules["settings.$i.value"] = ['present', 'nullable', 'string', 'max:254', 'email:rfc'];
            } elseif ($key === 'contact.phone') {
                $rules["settings.$i.value"] = ['present', 'nullable', 'string', 'max:30', 'regex:/^\+?[0-9 ().-]{6,30}$/'];
            } elseif (is_string($key) && str_starts_with($key, 'social.') && $key !== 'social.whatsapp') {
                $rules["settings.$i.value"] = ['present', 'nullable', 'string', 'max:255', 'url:https'];
            } elseif ($key === 'social.whatsapp') {
                $rules["settings.$i.value"] = ['present', 'nullable', 'string', 'max:255', 'regex:/^(\+?[0-9 ().-]{6,30}|https:\/\/[^\s]+)$/'];
            }
        }

        return $rules;
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['settings' => 'paramètres', 'settings.*.key' => 'clé', 'settings.*.value' => 'valeur', 'settings.*.is_public' => 'visibilité publique'];
    }

    /**
     * @return list<array{key: string, value: string, is_public?: bool}>
     */
    public function items(): array
    {
        $items = [];
        foreach ((array) $this->validated('settings') as $item) {
            $row = ['key' => (string) $item['key'], 'value' => trim(strip_tags((string) ($item['value'] ?? '')))];
            if (array_key_exists('is_public', $item)) {
                $row['is_public'] = (bool) $item['is_public'];
            }
            $items[] = $row;
        }

        return $items;
    }
}
