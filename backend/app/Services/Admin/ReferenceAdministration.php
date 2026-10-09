<?php

namespace App\Services\Admin;

use App\Exceptions\ApiHttpException;
use App\Models\City;
use App\Models\CompanyType;
use App\Models\District;
use App\Models\FeedbackTopic;
use App\Models\PostCategory;
use App\Models\ProcedureType;
use App\Models\ServiceType;
use App\Models\StateForceType;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Directory\DirectoryFilters;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Gestion des référentiels par l'administration (liste blanche de ressources et de champs).
 * Le slug est généré une fois à la création puis reste STABLE (les URL publiques ne changent pas).
 */
class ReferenceAdministration
{
    /**
     * Ressource d'URL => modèle, table, champs modifiables (noms d'attributs), longueurs.
     *
     * @var array<string, array{model: class-string<Model>, table: string, fields: list<string>, name_max: int, slug_max: int}>
     */
    private const RESOURCES = [
        'cities' => ['model' => City::class, 'table' => 'cities', 'fields' => ['name', 'sort_order', 'is_visible', 'latitude', 'longitude'], 'name_max' => 120, 'slug_max' => 140],
        'districts' => ['model' => District::class, 'table' => 'districts', 'fields' => ['name', 'is_visible', 'city_id', 'parent_id', 'latitude', 'longitude'], 'name_max' => 120, 'slug_max' => 140],
        'company-types' => ['model' => CompanyType::class, 'table' => 'company_types', 'fields' => ['name', 'description', 'sort_order', 'is_visible'], 'name_max' => 150, 'slug_max' => 120],
        'service-types' => ['model' => ServiceType::class, 'table' => 'service_types', 'fields' => ['name', 'description', 'icon', 'sort_order', 'is_visible'], 'name_max' => 150, 'slug_max' => 120],
        'state-force-types' => ['model' => StateForceType::class, 'table' => 'state_force_types', 'fields' => ['name', 'description', 'sort_order', 'is_visible'], 'name_max' => 150, 'slug_max' => 120],
        'procedure-types' => ['model' => ProcedureType::class, 'table' => 'procedure_types', 'fields' => ['name', 'description', 'sort_order', 'is_visible'], 'name_max' => 150, 'slug_max' => 120],
        'feedback-topics' => ['model' => FeedbackTopic::class, 'table' => 'feedback_topics', 'fields' => ['name', 'description', 'sort_order', 'is_visible'], 'name_max' => 150, 'slug_max' => 120],
        'post-categories' => ['model' => PostCategory::class, 'table' => 'post_categories', 'fields' => ['name', 'description', 'sort_order', 'is_visible'], 'name_max' => 150, 'slug_max' => 120],
    ];

    /**
     * Références (table.colonne) qui pointent vers chaque table : issues des clés étrangères des migrations.
     * Les lignes supprimées logiquement comptent aussi (la clé étrangère existe toujours).
     *
     * @var array<string, list<array{string, string}>>
     */
    private const USAGES = [
        'cities' => [['districts', 'city_id'], ['providers', 'city_id'], ['state_forces', 'city_id'], ['quote_requests', 'city_id']],
        'districts' => [['districts', 'parent_id'], ['providers', 'district_id'], ['state_forces', 'district_id'], ['quote_requests', 'district_id']],
        'company_types' => [['provider_company_type', 'company_type_id']],
        'service_types' => [['provider_service_type', 'service_type_id'], ['feedbacks', 'service_type_id'], ['quote_requests', 'service_type_id']],
        'state_force_types' => [['state_forces', 'force_type_id']],
        'procedure_types' => [['state_force_procedure_type', 'procedure_type_id']],
        'feedback_topics' => [['feedbacks', 'topic_id']],
        'post_categories' => [['posts', 'category_id']],
    ];

    public function __construct(private readonly AuditLogger $audit) {}

    /** @return array{model: class-string<Model>, table: string, fields: list<string>, name_max: int, slug_max: int} */
    public static function definition(string $resource): array
    {
        return self::RESOURCES[$resource] ?? throw new ApiHttpException(404, 'Ressource introuvable.');
    }

    /** @return LengthAwarePaginator<int, Model> */
    public function paginate(string $resource, ?string $search, int $perPage): LengthAwarePaginator
    {
        $def = self::definition($resource);
        $query = $def['model']::query();

        if ($search !== null && trim($search) !== '') {
            $like = '%'.DirectoryFilters::escapeLike(trim($search)).'%';
            $query->where(function ($w) use ($like, $def) {
                $w->whereRaw("{$def['table']}.name ILIKE ?", [$like])->orWhereRaw("{$def['table']}.slug ILIKE ?", [$like]);
            });
        }

        match ($resource) {
            'districts' => $query->orderBy('city_id')->orderBy('name'),
            'cities', 'company-types', 'service-types', 'state-force-types', 'procedure-types', 'feedback-topics', 'post-categories' => $query->orderBy('sort_order')->orderBy('name'),
            default => null,
        };

        return $query->orderBy('id')->paginate(min(50, max(1, $perPage)))->withQueryString();
    }

    /** @param array<string, mixed> $data */
    public function create(User $actor, string $resource, array $data): Model
    {
        $def = self::definition($resource);

        try {
            $model = DB::transaction(function () use ($actor, $resource, $def, $data) {
                $this->assertNameFree($resource, $def, (string) $data['name'], null, $data['city_id'] ?? null);
                $attributes = $this->onlyAllowed($def, $data);
                if ($resource === 'districts') {
                    $this->assertDistrictParent((int) $data['city_id'], $data['parent_id'] ?? null, null);
                }

                $model = new $def['model'];
                $model->forceFill($attributes + [
                    'slug' => $this->uniqueSlug($def, (string) $data['name'], $resource === 'districts' ? (int) $data['city_id'] : null),
                    'is_visible' => true,
                ])->save();

                $model->refresh();
                $this->audit->record('reference_created', null, null, null,
                    ['resource' => $resource, 'id' => $model->getKey(), 'name' => $model->getAttribute('name')], $actor);

                return $model;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => ['Cette valeur existe déjà.']]);
        }

        $this->forgetCaches();

        return $model;
    }

    /** @param array<string, mixed> $data */
    public function update(User $actor, string $resource, int $id, array $data): Model
    {
        $def = self::definition($resource);

        try {
            $model = DB::transaction(function () use ($actor, $resource, $def, $id, $data) {
                $model = $def['model']::query()->lockForUpdate()->findOrFail($id);
                $attributes = $this->onlyAllowed($def, $data);

                if ($resource === 'districts') {
                    if (isset($attributes['city_id']) && (int) $attributes['city_id'] !== (int) $model->getAttribute('city_id')) {
                        throw ValidationException::withMessages(['city_id' => ['La ville d\'un quartier ne peut pas être modifiée.']]);
                    }
                    unset($attributes['city_id']);
                    if (array_key_exists('parent_id', $attributes)) {
                        $this->assertDistrictParent((int) $model->getAttribute('city_id'), $attributes['parent_id'], (int) $model->getKey());
                    }
                }
                if (isset($attributes['name'])) {
                    $this->assertNameFree($resource, $def, (string) $attributes['name'], (int) $model->getKey(),
                        $resource === 'districts' ? $model->getAttribute('city_id') : null);
                }

                // Le slug n'est jamais recalculé : il n'est pas dans la liste blanche.
                $model->forceFill($attributes);
                if ($model->isDirty()) {
                    $old = array_intersect_key($model->getOriginal(), $model->getDirty());
                    $new = $model->getDirty();
                    $model->save();
                    $this->audit->record('reference_updated', null, $old, $new,
                        ['resource' => $resource, 'id' => $model->getKey(), 'name' => $model->getAttribute('name')], $actor);
                }

                return $model->refresh();
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => ['Cette valeur existe déjà.']]);
        }

        $this->forgetCaches();

        return $model;
    }

    public function delete(User $actor, string $resource, int $id): void
    {
        $def = self::definition($resource);

        try {
            DB::transaction(function () use ($actor, $resource, $def, $id) {
                $model = $def['model']::query()->lockForUpdate()->findOrFail($id);

                if ($this->isUsed($def['table'], $id)) {
                    throw new ApiHttpException(409, 'Valeur utilisée, masquez-la plutôt.');
                }

                $name = $model->getAttribute('name');
                $model->delete();
                $this->audit->record('reference_deleted', null, null, null,
                    ['resource' => $resource, 'id' => $id, 'name' => $name], $actor);
            });
        } catch (QueryException $e) {
            // Filet de sécurité : clé étrangère non prévue (SQLSTATE 23503) => même réponse.
            if ($e->getCode() === '23503') {
                throw new ApiHttpException(409, 'Valeur utilisée, masquez-la plutôt.');
            }
            throw $e;
        }

        $this->forgetCaches();
    }

    private function isUsed(string $table, int $id): bool
    {
        foreach (self::USAGES[$table] ?? [] as [$usingTable, $column]) {
            if (DB::table($usingTable)->where($column, $id)->exists()) {
                return true;
            }
        }

        return false;
    }

    private function forgetCaches(): void
    {
        Cache::forget('reference-data:v1');
        Cache::forget('home:stats:v1');
    }

    /**
     * @param  array{fields: list<string>}  $def
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function onlyAllowed(array $def, array $data): array
    {
        return array_intersect_key($data, array_flip($def['fields']));
    }

    /** @param array{table: string, name_max: int, slug_max: int, model: class-string<Model>, fields: list<string>} $def */
    private function assertNameFree(string $resource, array $def, string $name, ?int $ignoreId, mixed $cityId): void
    {
        $query = DB::table($def['table'])->whereRaw('lower(unaccent(name)) = lower(unaccent(?::text))', [$name]);
        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }
        if ($resource === 'districts') {
            $query->where('city_id', $cityId);
        }
        if ($query->exists()) {
            throw ValidationException::withMessages(['name' => ['Cette valeur existe déjà.']]);
        }
    }

    /** Le parent doit exister dans la même ville, ne pas être le quartier lui-même ni un de ses descendants. */
    private function assertDistrictParent(int $cityId, mixed $parentId, ?int $selfId): void
    {
        if ($parentId === null || $parentId === '') {
            return;
        }
        $parent = District::query()->find((int) $parentId);
        if ($parent === null || (int) $parent->city_id !== $cityId) {
            throw ValidationException::withMessages(['parent_id' => ['Le quartier parent doit appartenir à la même ville.']]);
        }
        $cursor = $parent;
        for ($depth = 0; $cursor !== null && $depth < 50; $depth++) {
            if ($selfId !== null && (int) $cursor->id === $selfId) {
                throw ValidationException::withMessages(['parent_id' => ['Un quartier ne peut pas dépendre de lui-même ni de l\'un de ses sous-quartiers.']]);
            }
            $cursor = $cursor->parent_id === null ? null : District::query()->find($cursor->parent_id);
        }
    }

    /** @param array{table: string, slug_max: int} $def */
    private function uniqueSlug(array $def, string $name, ?int $cityId): string
    {
        $base = Str::slug($name);
        $base = $base === '' ? 'valeur' : $base;
        $max = $def['slug_max'];
        $base = rtrim(mb_substr($base, 0, $max - 6), '-');

        $candidate = $base;
        for ($i = 2; $i < 10000; $i++) {
            $query = DB::table($def['table'])->where('slug', $candidate);
            if ($cityId !== null) {
                $query->where('city_id', $cityId);
            }
            if (! $query->exists()) {
                return $candidate;
            }
            $candidate = $base.'-'.$i;
        }

        throw ValidationException::withMessages(['name' => ['Impossible de générer un identifiant unique.']]);
    }
}
