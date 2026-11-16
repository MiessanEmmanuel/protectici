<?php

namespace App\Services\Imports;

use App\Enums\EstablishmentType;
use App\Support\Imports\ImportColumns;
use Illuminate\Support\Facades\DB;

/**
 * Doublons probables d'une ligne : fiches existantes du même type (non supprimées) puis lignes précédentes du
 * fichier. Critères, du plus sûr au plus faible : RCCM, n° d'agrément, e-mail, téléphone (principal ou 2), nom
 * normalisé + ville. Les numéros courts d'urgence ne servent jamais de critère.
 * Un doublon sur RCCM ou n° d'agrément est « bloquant » : ces valeurs sont uniques en base.
 */
class ImportDuplicateFinder
{
    private const REASONS = ['rccm', 'approval_number', 'email', 'phone', 'name_city'];

    /** @var array<string, array<string, array{id: int, name: string, city: string|null}>> */
    private array $existing = [];

    /** @var array<string, array<string, array{line: int, name: string, city: string|null}>> */
    private array $file = [];

    public function __construct(private readonly EstablishmentType $type)
    {
        foreach (self::REASONS as $reason) {
            $this->existing[$reason] = [];
            $this->file[$reason] = [];
        }

        $columns = ['e.id', 'e.name', 'e.city_id', 'e.phone', 'e.phone_alt', 'e.email', 'c.name as city_name'];
        if ($type === EstablishmentType::Provider) {
            array_push($columns, 'e.rccm', 'e.approval_number');
        }

        DB::table($type->table().' as e')->leftJoin('cities as c', 'c.id', '=', 'e.city_id')
            ->whereNull('e.deleted_at')->orderBy('e.id')->select($columns)
            ->lazyById(1000, 'e.id', 'id')
            ->each(function (object $row): void {
                $match = ['id' => (int) $row->id, 'name' => (string) $row->name, 'city' => $row->city_name];
                foreach ($this->keys([
                    'name' => (string) $row->name, 'city_id' => (int) $row->city_id, 'phone' => $row->phone,
                    'phone_alt' => $row->phone_alt, 'email' => $row->email,
                    'rccm' => $row->rccm ?? null, 'approval_number' => $row->approval_number ?? null,
                ]) as $reason => $keys) {
                    foreach ($keys as $key) {
                        $this->existing[$reason][$key] ??= $match;
                    }
                }
            });
    }

    /**
     * Cherche un doublon puis enregistre la ligne pour les suivantes.
     *
     * @param  array<string, mixed>  $data  données validées de la ligne
     * @return array{duplicate_of: array{type: string, id: int, name: string, city: string|null, reason: string}, blocking: bool}|null
     */
    public function check(int $line, array $data, ?string $city): ?array
    {
        $keys = $this->keys($data);
        $found = null;

        foreach (self::REASONS as $reason) {
            foreach ($keys[$reason] as $key) {
                if (isset($this->existing[$reason][$key])) {
                    $m = $this->existing[$reason][$key];
                    $found = ['duplicate_of' => ['type' => $this->type->value, 'id' => $m['id'], 'name' => $m['name'], 'city' => $m['city'], 'reason' => $reason], 'blocking' => $this->blocking($reason)];
                    break 2;
                }
            }
        }
        if ($found === null) {
            foreach (self::REASONS as $reason) {
                foreach ($keys[$reason] as $key) {
                    if (isset($this->file[$reason][$key])) {
                        $m = $this->file[$reason][$key];
                        $found = ['duplicate_of' => ['type' => 'row', 'id' => $m['line'], 'name' => $m['name'], 'city' => $m['city'], 'reason' => 'file'], 'blocking' => $this->blocking($reason)];
                        break 2;
                    }
                }
            }
        }

        foreach ($keys as $reason => $values) {
            foreach ($values as $key) {
                $this->file[$reason][$key] ??= ['line' => $line, 'name' => (string) ($data['name'] ?? ''), 'city' => $city];
            }
        }

        return $found;
    }

    private function blocking(string $reason): bool
    {
        return in_array($reason, ['rccm', 'approval_number'], true);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, list<string>>
     */
    private function keys(array $data): array
    {
        $keys = array_fill_keys(self::REASONS, []);

        $name = ImportColumns::normalize((string) ($data['name'] ?? ''));
        if ($name !== '' && isset($data['city_id'])) {
            $keys['name_city'][] = $name.'|'.(int) $data['city_id'];
        }
        foreach (['phone', 'phone_alt'] as $field) {
            $phone = $data[$field] ?? null;
            if (is_string($phone) && preg_match('/^\+\d{8,15}$/', $phone) === 1) {
                $keys['phone'][] = $phone;
            }
        }
        if (is_string($data['email'] ?? null) && $data['email'] !== '') {
            $keys['email'][] = mb_strtolower(trim($data['email']));
        }
        foreach (['rccm', 'approval_number'] as $field) {
            if (is_string($data[$field] ?? null) && $data[$field] !== '') {
                $keys[$field][] = mb_strtoupper(preg_replace('/[\s.\-\/]+/', '', $data[$field]) ?? '');
            }
        }

        $keys['phone'] = array_values(array_unique($keys['phone']));

        return $keys;
    }
}
