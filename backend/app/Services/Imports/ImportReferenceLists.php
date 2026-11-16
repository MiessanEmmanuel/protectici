<?php

namespace App\Services\Imports;

use App\Enums\EstablishmentType;
use App\Support\Imports\ImportColumns;
use Illuminate\Support\Facades\DB;

/**
 * Valeurs autorisées des colonnes à liste fermée, lues dans la base (référentiels visibles uniquement).
 * Sert au modèle (feuille « Listes ») et à l'analyse (correspondance insensible aux accents et à la casse).
 */
class ImportReferenceLists
{
    /** @var array<string, list<array{id: int|string, name: string, slug?: string, city_id?: int}>>|null */
    private ?array $cache = null;

    /** @var array<string, array<int|string, mixed>>|null */
    private ?array $index = null;

    /** Libellés de la feuille « Listes » : source => [titre, valeurs]. */
    /** @return array<string, array{title: string, values: list<string>}> */
    public function sheetLists(EstablishmentType $type): array
    {
        $lists = $this->all();
        $cityNames = [];
        foreach ($lists['cities'] as $city) {
            $cityNames[(int) $city['id']] = $city['name'];
        }

        $sheet = [
            'cities' => ['title' => 'Villes', 'values' => array_column($lists['cities'], 'name')],
            'districts' => ['title' => 'Communes / quartiers', 'values' => array_values(array_filter(array_map(
                fn (array $d): ?string => isset($cityNames[$d['city_id'] ?? 0]) ? $d['name'].' ('.$cityNames[$d['city_id']].')' : null,
                $lists['districts'],
            )))],
        ];

        if ($type === EstablishmentType::StateForce) {
            $sheet['state_force_types'] = ['title' => 'Types de force', 'values' => array_column($lists['state_force_types'], 'name')];
            $sheet['procedure_types'] = ['title' => 'Démarches', 'values' => array_column($lists['procedure_types'], 'name')];
            $sheet['yes_no'] = ['title' => 'Oui / Non', 'values' => ['Oui', 'Non']];
        } else {
            $sheet['company_types'] = ['title' => 'Types d\'entreprise', 'values' => array_column($lists['company_types'], 'name')];
            $sheet['service_types'] = ['title' => 'Services', 'values' => array_column($lists['service_types'], 'name')];
            $sheet['legal_forms'] = ['title' => 'Formes juridiques', 'values' => array_keys(ImportColumns::LEGAL_FORMS)];
        }

        return $sheet;
    }

    /** Identifiant d'une valeur de référentiel (par libellé ou slug), ou null si inconnue. */
    public function find(string $list, string $value): ?int
    {
        $needle = ImportColumns::normalize($value);

        return $needle === '' ? null : ($this->index()[$list][$needle] ?? null);
    }

    /**
     * Commune / quartier : « Cocody (Abidjan) » ou « Cocody ». Retourne [id|null, nom de la ville où cette commune
     * existe si ce n'est pas la ville de la ligne|null].
     *
     * @return array{0: int|null, 1: string|null}
     */
    public function findDistrict(string $value, int $cityId): array
    {
        $name = trim($value);
        $cityPart = null;
        if (preg_match('/^(.*)\(([^()]*)\)\s*$/u', $name, $m) === 1) {
            $name = trim($m[1]);
            $cityPart = ImportColumns::normalize($m[2]);
        }

        $elsewhere = null;
        foreach ($this->index()['districts'][ImportColumns::normalize($name)] ?? [] as [$id, $districtCity]) {
            $cityName = $this->cityName($districtCity) ?? '';
            if ($cityPart !== null && ImportColumns::normalize($cityName) !== $cityPart) {
                continue;
            }
            if ($districtCity === $cityId) {
                return [$id, null];
            }
            $elsewhere ??= $cityName;
        }

        return [null, $elsewhere];
    }

    public function cityName(int $id): ?string
    {
        return $this->index()['city_names'][$id] ?? null;
    }

    /**
     * Index de recherche : liste => [forme normalisée => id] ; districts => [forme normalisée => [[id, city_id]…]].
     *
     * @return array<string, array<int|string, mixed>>
     */
    private function index(): array
    {
        if ($this->index !== null) {
            return $this->index;
        }

        $index = ['city_names' => [], 'districts' => []];
        foreach ($this->all() as $list => $rows) {
            if ($list === 'districts') {
                continue;
            }
            $index[$list] = [];
            foreach ($rows as $row) {
                foreach ([$row['name'], $row['slug'] ?? ''] as $label) {
                    $key = ImportColumns::normalize((string) $label);
                    if ($key !== '') {
                        $index[$list][$key] ??= (int) $row['id'];
                    }
                }
            }
        }
        foreach ($this->all()['cities'] as $city) {
            $index['city_names'][(int) $city['id']] = $city['name'];
        }
        foreach ($this->all()['districts'] as $district) {
            foreach (array_unique([ImportColumns::normalize($district['name']), ImportColumns::normalize((string) ($district['slug'] ?? ''))]) as $key) {
                if ($key !== '') {
                    $index['districts'][$key][] = [(int) $district['id'], (int) ($district['city_id'] ?? 0)];
                }
            }
        }

        return $this->index = $index;
    }

    /** @return array<string, list<array{id: int|string, name: string, slug?: string, city_id?: int}>> */
    private function all(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }

        $reference = fn (string $table): array => DB::table($table)->where('is_visible', true)
            ->orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'slug'])
            ->map(fn (object $r): array => ['id' => (int) $r->id, 'name' => (string) $r->name, 'slug' => (string) $r->slug])->all();

        return $this->cache = [
            'cities' => $reference('cities'),
            'districts' => DB::table('districts')->join('cities', 'cities.id', '=', 'districts.city_id')
                ->where('districts.is_visible', true)->where('cities.is_visible', true)
                ->orderBy('cities.sort_order')->orderBy('cities.name')->orderBy('districts.name')
                ->get(['districts.id', 'districts.name', 'districts.slug', 'districts.city_id'])
                ->map(fn (object $r): array => ['id' => (int) $r->id, 'name' => (string) $r->name, 'slug' => (string) $r->slug, 'city_id' => (int) $r->city_id])->all(),
            'state_force_types' => $reference('state_force_types'),
            'procedure_types' => $reference('procedure_types'),
            'company_types' => $reference('company_types'),
            'service_types' => $reference('service_types'),
        ];
    }
}
