<?php

namespace App\Http\Requests\Admin;

use App\Services\Admin\ReferenceAdministration;
use App\Support\PlainText;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Création / modification d'une valeur de référentiel. Liste blanche de champs PAR ressource : tout autre champ
 * (slug, id, created_at...) est ignoré. Le slug est généré par le service, jamais fourni par le client.
 */
class SaveReferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('name'))) {
            $merge['name'] = PlainText::single($this->input('name'));
        }
        if (is_string($this->input('description'))) {
            $merge['description'] = PlainText::multiline($this->input('description'));
        }
        if (is_string($this->input('icon'))) {
            $merge['icon'] = PlainText::single($this->input('icon'));
        }
        // Alias du contrat : lat / lng -> colonnes latitude / longitude.
        if ($this->exists('lat')) {
            $merge['latitude'] = $this->input('lat');
        }
        if ($this->exists('lng')) {
            $merge['longitude'] = $this->input('lng');
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $def = ReferenceAdministration::definition((string) $this->route('resource'));
        $presence = $this->isMethod('POST') ? 'required' : 'sometimes';

        $rules = [
            'name' => [$presence, 'string', 'min:2', 'max:'.$def['name_max']],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:60', 'regex:/^[a-z0-9_-]+$/i'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:32767'],
            'is_visible' => ['sometimes', 'boolean'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'city_id' => [$presence, 'integer', 'exists:cities,id'],
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:districts,id'],
        ];

        return array_intersect_key($rules, array_flip($def['fields']));
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Le nom est obligatoire.',
            'name.min' => 'Le nom doit comporter au moins 2 caractères.',
            'name.max' => 'Le nom est trop long.',
            'icon.regex' => 'L\'icône n\'est pas valide.',
            'sort_order.min' => 'L\'ordre doit être compris entre 0 et 32767.',
            'sort_order.max' => 'L\'ordre doit être compris entre 0 et 32767.',
            'city_id.required' => 'La ville est obligatoire.',
            'city_id.exists' => 'La ville choisie n\'existe pas.',
            'parent_id.exists' => 'Le quartier parent n\'existe pas.',
            'latitude.between' => 'La latitude n\'est pas valide.',
            'longitude.between' => 'La longitude n\'est pas valide.',
        ];
    }

    /** @return array<int, \Closure> */
    public function after(): array
    {
        return [function (Validator $validator) {
            $fields = ReferenceAdministration::definition((string) $this->route('resource'))['fields'];
            if (! in_array('latitude', $fields, true)) {
                return;
            }
            // Coordonnées en paire : les deux renseignées, ou les deux vides.
            $hasLat = $this->exists('latitude');
            $hasLng = $this->exists('longitude');
            if ($hasLat !== $hasLng || ($hasLat && ($this->input('latitude') === null) !== ($this->input('longitude') === null))) {
                $validator->errors()->add('lat', 'La latitude et la longitude vont de pair.');
            }
        }];
    }

    /**
     * Valeurs validées, restreintes à la liste blanche de la ressource (noms d'attributs du modèle).
     *
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        $def = ReferenceAdministration::definition((string) $this->route('resource'));
        $data = $this->validated();

        if (array_key_exists('is_visible', $data)) {
            $data['is_visible'] = $this->boolean('is_visible');
        }
        if (array_key_exists('description', $data) && $data['description'] === '') {
            $data['description'] = null;
        }

        return array_intersect_key($data, array_flip($def['fields']));
    }
}
