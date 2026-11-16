<?php

namespace App\Http\Requests\Admin\Imports;

use App\Enums\EstablishmentType;
use App\Models\EstablishmentImport;
use App\Services\Imports\EstablishmentImportParser;
use App\Services\Imports\ImportFileException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Téléversement d'un fichier d'import (contrat §10.2, security.md §6) : extension .xlsx, 5 Mo, puis contrôle du
 * contenu réel (signature ZIP/OOXML, taille décompressée, en-têtes obligatoires, 1 à 2 000 lignes de données).
 */
class StoreEstablishmentImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', EstablishmentImport::class) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(EstablishmentType::values())],
            'publish_mode' => ['nullable', 'string', Rule::in(EstablishmentImport::PUBLISH_MODES)],
            'file' => ['required', 'file', 'max:'.(int) config('imports.max_kb', 5120), 'extensions:xlsx'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'file.required' => 'Choisissez un fichier Excel (.xlsx).',
            'file.file' => 'Le fichier n\'a pas pu être téléversé.',
            'file.uploaded' => 'Le fichier n\'a pas pu être téléversé.',
            'file.max' => 'Le fichier ne doit pas dépasser 5 Mo.',
            'file.extensions' => 'Le fichier doit être au format Excel (.xlsx).',
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['type' => 'type de fiche', 'publish_mode' => 'statut des fiches créées', 'file' => 'fichier'];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $file = $this->file('file');
            $type = EstablishmentType::tryFrom((string) $this->input('type'));
            if (! $file instanceof UploadedFile || $type === null) {
                return;
            }

            try {
                app(EstablishmentImportParser::class)->read($type, (string) $file->getRealPath());
            } catch (ImportFileException $e) {
                $validator->errors()->add('file', $e->getMessage());
            }
        }];
    }

    public function establishmentType(): EstablishmentType
    {
        return EstablishmentType::from((string) $this->validated('type'));
    }

    public function publishMode(): string
    {
        return (string) ($this->validated('publish_mode') ?? 'publish');
    }
}
