<?php

namespace App\Services\Media;

use App\Enums\EstablishmentType;
use App\Models\Provider;
use App\Models\ProviderDocument;
use App\Models\StateForce;
use App\Services\AuditLogger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Justificatifs (PDF/JPEG/PNG) sur disque PRIVÉ. Type réel vérifié par contenu ; images réencodées (EXIF supprimé) ;
 * PDF refusés s'ils contiennent du contenu actif ; nom aléatoire, extension déduite du type détecté.
 */
class DocumentManager
{
    private const MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

    private const ACTIVE_PDF = '#/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA|OpenAction|AA)\b#';

    public function __construct(private readonly ImageProcessor $images, private readonly AuditLogger $audit) {}

    public function store(Provider|StateForce $establishment, UploadedFile $file, string $type): ProviderDocument
    {
        $path = $file->getRealPath();
        $bytes = $path === false ? false : file_get_contents($path);
        if ($bytes === false || $bytes === '') {
            throw ValidationException::withMessages(['file' => ['Le fichier est vide ou illisible.']]);
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        if (! is_string($mime) || ! in_array($mime, self::MIMES, true)) {
            throw ValidationException::withMessages(['file' => ['Seuls les fichiers PDF, JPEG et PNG sont acceptés.']]);
        }

        if ($mime === 'application/pdf') {
            if (! str_starts_with(ltrim(substr($bytes, 0, 1024)), '%PDF-') || preg_match(self::ACTIVE_PDF, $bytes) === 1) {
                throw ValidationException::withMessages(['file' => ['Ce PDF n\'est pas valide ou contient du contenu actif.']]);
            }
            $binary = $bytes;
            $extension = 'pdf';
        } else {
            $image = $this->images->process($file, self::MIMES, (int) config('establishments.documents.max_edge', 4000), 'same');
            $binary = $image['binary'];
            $mime = $image['mime'];
            $extension = $image['extension'];
        }

        $disk = (string) config('establishments.documents_disk');
        $kind = EstablishmentType::tryFromModel($establishment);
        $storagePath = "documents/{$kind->value}/{$establishment->id}/".Str::lower((string) Str::ulid()).'.'.$extension;

        return DB::transaction(function () use ($establishment, $kind, $type, $file, $disk, $storagePath, $binary, $mime) {
            $establishment::query()->whereKey($establishment->getKey())->lockForUpdate()->first();

            $count = ProviderDocument::query()->where($kind->foreignKey(), $establishment->getKey())->count();
            if ($count >= (int) config('establishments.documents.max_per_establishment', 5)) {
                throw ValidationException::withMessages(['file' => ['Vous ne pouvez pas dépasser 5 justificatifs par fiche.']]);
            }

            Storage::disk($disk)->put($storagePath, $binary, 'private');

            try {
                $document = (new ProviderDocument)->fill([
                    $kind->foreignKey() => $establishment->getKey(),
                    'type' => $type,
                    'disk' => $disk,
                    'path' => $storagePath,
                    'original_name' => $this->safeName($file->getClientOriginalName()),
                    'mime_type' => $mime,
                    'size_bytes' => strlen($binary),
                ]);
                $document->save();
            } catch (\Throwable $e) {
                Storage::disk($disk)->delete($storagePath);
                throw $e;
            }

            $this->audit->record('document_uploaded', $establishment, null, null, ['type' => $type]);

            return $document;
        });
    }

    public function destroy(Provider|StateForce $establishment, ProviderDocument $document): void
    {
        DB::transaction(function () use ($establishment, $document) {
            $document->delete();
            $this->audit->record('document_deleted', $establishment, null, null, ['type' => $document->type]);
        });
        Storage::disk($document->disk)->delete($document->path);
    }

    private function safeName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[^\p{L}\p{N}._ -]/u', '', $name) ?? '';

        return Str::limit($name !== '' ? $name : 'justificatif', 200, '');
    }
}
