<?php

namespace App\Http\Requests\Establishment;

use App\Enums\EstablishmentType;
use App\Http\Requests\Concerns\RejectsMarkup;
use App\Rules\PhoneNumber;
use App\Support\Establishments\EstablishmentSchema;
use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Base des requêtes d'établissement : nettoyage du texte (balises, caractères de contrôle), normalisation E.164
 * des téléphones, puis validation en liste blanche (EstablishmentSchema). Les champs inconnus sont ignorés.
 */
abstract class EstablishmentRequest extends FormRequest
{
    use RejectsMarkup;

    abstract protected function establishmentType(): ?EstablishmentType;

    protected function prepareForValidation(): void
    {
        $type = $this->establishmentType();
        if ($type === null) {
            return;
        }

        $merge = [];
        foreach (EstablishmentSchema::textFields($type) as $field => $mode) {
            if ($this->has($field) && is_string($this->input($field))) {
                $merge[$field] = $mode === 'single' ? PlainText::single($this->input($field)) : PlainText::multiline($this->input($field));
            }
        }
        foreach (EstablishmentSchema::phoneFields($type) as $field) {
            if ($this->has($field)) {
                $merge[$field] = PhoneNumber::normalize($this->input($field));
            }
        }
        foreach (['website_url', 'facebook_url', 'instagram_url', 'twitter_url', 'linkedin_url'] as $field) {
            if (is_string($this->input($field))) {
                $merge[$field] = trim($this->input($field));
            }
        }
        if (is_array($this->input('executives'))) {
            $merge['executives'] = array_map(fn ($row) => is_array($row) ? array_merge($row, array_filter([
                'full_name' => isset($row['full_name']) ? PlainText::single($row['full_name']) : null,
                'position_label' => isset($row['position_label']) ? PlainText::single($row['position_label']) : null,
            ], fn ($v) => $v !== null)) : $row, $this->input('executives'));
        }
        if (is_array($this->input('branches'))) {
            $merge['branches'] = array_map(fn ($row) => is_array($row) ? $this->cleanBranch($row) : $row, $this->input('branches'));
        }
        if (is_array($this->input('procedures'))) {
            $merge['procedures'] = array_map(fn ($row) => is_array($row) && isset($row['notes']) ? array_merge($row, ['notes' => PlainText::multiline($row['notes'])]) : $row, $this->input('procedures'));
        }

        $this->merge($merge);
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function cleanBranch(array $row): array
    {
        foreach (['label' => 'single', 'address' => 'single', 'geo_description' => 'multiline'] as $field => $mode) {
            if (isset($row[$field]) && is_string($row[$field])) {
                $row[$field] = $mode === 'single' ? PlainText::single($row[$field]) : PlainText::multiline($row[$field]);
            }
        }
        if (array_key_exists('phone', $row)) {
            $row['phone'] = PhoneNumber::normalize($row['phone']);
        }

        return $row;
    }

    /** @return array<string, mixed> */
    protected function schemaRules(bool $partial): array
    {
        $type = $this->establishmentType();

        return $type === null ? [] : EstablishmentSchema::rules($type, $partial);
    }
}
