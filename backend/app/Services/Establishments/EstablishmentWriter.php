<?php

namespace App\Services\Establishments;

use App\Enums\EstablishmentType;
use App\Models\ConsentLog;
use App\Models\District;
use App\Models\Provider;
use App\Models\ProviderExecutive;
use App\Models\StateForce;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\Establishments\EstablishmentSchema;
use App\Support\IpHasher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Écriture des fiches (prestataires et forces étatiques). Seules les listes blanches de EstablishmentSchema
 * atteignent la base : status, is_visible, is_verified, is_featured, user_id, reviewed_* sont posés par le serveur.
 */
class EstablishmentWriter
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Création : fiche `pending`, non visible, rattachée au demandeur ; consentement tracé.
     *
     * @param  array<string, mixed>  $data  données validées (liste blanche)
     */
    public function create(User $owner, EstablishmentType $type, array $data, ?string $ip): Provider|StateForce
    {
        return DB::transaction(function () use ($owner, $type, $data, $ip) {
            $model = $type === EstablishmentType::Provider ? new Provider : new StateForce;

            $this->assertDistrictMatchesCity($data['district_id'] ?? null, (int) $data['city_id']);

            $model->forceFill($this->columns($type, $data, EstablishmentSchema::creatable($type)));
            $model->forceFill([
                'user_id' => $owner->id,
                'slug' => $this->uniqueSlug($type, (string) $data['name']),
                'status' => 'pending',
                'is_visible' => false,
            ]);
            $model->save();

            $this->syncRelations($model, $type, $data);

            ConsentLog::create([
                'user_id' => $owner->id,
                'email' => $owner->email,
                'purpose' => 'establishment',
                'policy_version' => (string) config('app.policy_version'),
                'granted' => true,
                'ip_hash' => IpHasher::hash($ip),
            ]);

            $this->audit->record('establishment_created', $model, null, ['status' => 'pending'], ['type' => $type->value], $owner);

            return $model;
        });
    }

    /**
     * Mise à jour par le propriétaire : champs NON sensibles uniquement. Une valeur sensible différente de la
     * valeur actuelle est refusée (il faut une demande de modification) ; une valeur identique est ignorée.
     *
     * @param  array<string, mixed>  $data  données validées
     */
    public function updateByOwner(Provider|StateForce $model, array $data): Provider|StateForce
    {
        $type = EstablishmentType::tryFromModel($model);

        $this->rejectSensitiveChanges($model, $type, $data);

        return $this->update($model, $type, $data, EstablishmentSchema::ownerEditable($type), 'establishment_updated');
    }

    /**
     * Mise à jour par un administrateur : tous les champs, y compris sensibles, plus is_featured (providers).
     *
     * @param  array<string, mixed>  $data  données validées
     */
    public function updateByAdmin(Provider|StateForce $model, array $data): Provider|StateForce
    {
        $type = EstablishmentType::tryFromModel($model);
        $allowed = EstablishmentSchema::creatable($type);
        // submitter_role : information d'origine, non modifiable après coup.
        $allowed = array_values(array_diff($allowed, ['submitter_role']));

        return $this->update($model, $type, $data, $allowed, 'establishment_updated_by_admin');
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<string>  $allowed
     */
    private function update(Provider|StateForce $model, EstablishmentType $type, array $data, array $allowed, string $event): Provider|StateForce
    {
        return DB::transaction(function () use ($model, $type, $data, $allowed, $event) {
            $cityId = (int) ($data['city_id'] ?? $model->city_id);
            $districtId = array_key_exists('district_id', $data) ? $data['district_id'] : $model->district_id;
            if (array_key_exists('city_id', $data) || array_key_exists('district_id', $data)) {
                $this->assertDistrictMatchesCity($districtId, $cityId);
            }

            $columns = $this->columns($type, $data, $allowed);
            // Un changement de ville sans quartier précisé invalide l'ancien quartier.
            if (array_key_exists('city_id', $columns) && (int) $columns['city_id'] !== (int) $model->city_id && ! array_key_exists('district_id', $columns)) {
                $columns['district_id'] = null;
            }

            $model->forceFill($columns);
            if ($type === EstablishmentType::Provider && array_key_exists('is_featured', $data) && $event === 'establishment_updated_by_admin') {
                $model->forceFill(['is_featured' => (bool) $data['is_featured']]);
            }

            $changed = array_keys($model->getDirty());
            $model->save();

            $relationChanged = $this->syncRelations($model, $type, $data, $allowed);

            $fields = array_values(array_diff(array_merge($changed, $relationChanged), ['updated_at']));
            if ($fields !== []) {
                // Noms des champs seulement : jamais de valeurs (RCCM, agrément… sont des données légales sensibles).
                $this->audit->record($event, $model, null, null, ['fields' => $fields]);
            }

            return $model;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<string>  $allowed
     * @return array<string, mixed>
     */
    private function columns(EstablishmentType $type, array $data, array $allowed): array
    {
        $columns = [];
        foreach ($allowed as $field) {
            if (in_array($field, EstablishmentSchema::RELATION_FIELDS, true) || ! array_key_exists($field, $data)) {
                continue;
            }
            $columns[EstablishmentSchema::column($field)] = $data[$field];
        }

        // lat/lng : toujours enregistrés ensemble (contrainte lat_lng_pair_chk).
        if (array_key_exists('latitude', $columns) xor array_key_exists('longitude', $columns)) {
            unset($columns['latitude'], $columns['longitude']);
        }

        return $columns;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function rejectSensitiveChanges(Provider|StateForce $model, EstablishmentType $type, array $data): void
    {
        $errors = [];
        foreach (EstablishmentSchema::sensitive($type) as $field) {
            if (! array_key_exists($field, $data)) {
                continue;
            }
            $current = $model->getAttribute(EstablishmentSchema::column($field));
            if ($this->normalize($data[$field]) !== $this->normalize($current)) {
                $errors[$field] = ['Ce champ nécessite une demande de modification.'];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function normalize(mixed $value): string
    {
        return $value === null ? '' : trim((string) $value);
    }

    private function assertDistrictMatchesCity(mixed $districtId, int $cityId): void
    {
        if ($districtId === null) {
            return;
        }

        if (! District::query()->whereKey($districtId)->where('city_id', $cityId)->exists()) {
            throw ValidationException::withMessages(['district_id' => ['Ce quartier n\'appartient pas à la ville choisie.']]);
        }
    }

    /**
     * Synchronise les relations présentes dans $data ; retourne les noms de champs modifiés.
     *
     * @param  array<string, mixed>  $data
     * @param  list<string>|null  $allowed
     * @return list<string>
     */
    private function syncRelations(Provider|StateForce $model, EstablishmentType $type, array $data, ?array $allowed = null): array
    {
        $allowed ??= EstablishmentSchema::creatable($type);
        $changed = [];
        $has = fn (string $key): bool => array_key_exists($key, $data) && in_array($key, $allowed, true);

        if ($model instanceof Provider) {
            if ($has('company_type_ids')) {
                $changed[] = 'company_type_ids';
                $model->companyTypes()->sync($data['company_type_ids']);
            }
            if ($has('service_type_ids')) {
                $changed[] = 'service_type_ids';
                $model->serviceTypes()->sync($data['service_type_ids']);
            }
            if ($has('executives')) {
                $changed[] = 'executives';
                $this->syncExecutives($model, $data['executives'] ?? []);
            }
        } else {
            $sync = null;
            if ($has('procedures')) {
                $sync = [];
                foreach ($data['procedures'] as $row) {
                    $sync[(int) $row['procedure_type_id']] = ['notes' => $row['notes'] ?? null];
                }
            } elseif ($has('procedure_type_ids')) {
                $existing = DB::table('state_force_procedure_type')->where('state_force_id', $model->id)->pluck('notes', 'procedure_type_id');
                $sync = [];
                foreach ($data['procedure_type_ids'] as $id) {
                    $sync[(int) $id] = ['notes' => $existing[$id] ?? null];
                }
            }
            if ($sync !== null) {
                $changed[] = 'procedure_type_ids';
                $model->procedureTypes()->sync($sync);
            }
        }

        return $changed;
    }

    /**
     * Remplacement de la liste des dirigeants. Les lignes sont conservées par `id` (appartenant à cette fiche),
     * les autres sont créées, les absentes supprimées. Affichage public seulement si is_visible (consentement).
     *
     * @param  list<array<string, mixed>>  $executives
     */
    private function syncExecutives(Provider $provider, array $executives): void
    {
        $existing = ProviderExecutive::query()->where('provider_id', $provider->id)->get()->keyBy('id');
        $keep = [];

        foreach (array_values($executives) as $position => $row) {
            $id = isset($row['id']) ? (int) $row['id'] : null;
            $executive = $id !== null ? $existing->get($id) : null;
            $executive ??= new ProviderExecutive;

            $executive->forceFill([
                'provider_id' => $provider->id,
                'full_name' => $row['full_name'],
                'position' => $row['position'],
                'position_label' => $row['position_label'] ?? null,
                'sort_order' => $position,
                'is_visible' => (bool) ($row['is_visible'] ?? false),
            ])->save();

            $keep[] = $executive->id;
        }

        ProviderExecutive::query()->where('provider_id', $provider->id)->whereNotIn('id', $keep)->delete();
    }

    private function uniqueSlug(EstablishmentType $type, string $name): string
    {
        $base = Str::slug(Str::limit($name, 180, ''));
        $base = $base !== '' ? $base : ($type === EstablishmentType::Provider ? 'prestataire' : 'force-etatique');

        $slug = $base;
        $suffix = 2;
        while ($type->query()->withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
            if ($suffix > 50) {
                $slug = $base.'-'.Str::lower(Str::random(6));
                break;
            }
        }

        return $slug;
    }
}
