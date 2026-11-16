<?php

namespace App\Services\Imports;

use App\Models\EstablishmentImport;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Fichiers d'import sur le disque privé (security.md §6, §16) : nom aléatoire `imports/{uuid}.xlsx`, jamais le nom
 * fourni ; lecture via une copie temporaire locale (le disque peut être un bucket S3/R2 privé).
 */
class ImportFileStore
{
    public function disk(): string
    {
        return (string) config('imports.disk', 'private');
    }

    public function store(UploadedFile $file): string
    {
        $path = 'imports/'.Str::uuid()->toString().'.xlsx';
        $stream = fopen($file->getRealPath(), 'rb');
        if ($stream === false) {
            throw new ImportFileException('Le fichier n\'a pas pu être lu.');
        }

        try {
            Storage::disk($this->disk())->writeStream($path, $stream);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        return $path;
    }

    public function exists(EstablishmentImport $import): bool
    {
        if ($import->file_path === null) {
            return false;
        }

        try {
            return Storage::disk($import->file_disk)->exists($import->file_path);
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @template T
     *
     * @param  callable(string): T  $callback  reçoit le chemin local de la copie
     * @return T
     *
     * @throws ImportFileException
     */
    public function withLocalCopy(EstablishmentImport $import, callable $callback): mixed
    {
        if (! $this->exists($import)) {
            throw new ImportFileException('Le fichier d\'import n\'est plus disponible.');
        }

        $source = Storage::disk($import->file_disk)->readStream((string) $import->file_path);
        $local = tempnam(sys_get_temp_dir(), 'import');
        if ($source === null || $local === false) {
            throw new ImportFileException('Le fichier d\'import n\'a pas pu être lu.');
        }

        try {
            $target = fopen($local, 'wb');
            if ($target === false) {
                throw new ImportFileException('Le fichier d\'import n\'a pas pu être lu.');
            }
            stream_copy_to_stream($source, $target);
            fclose($target);

            return $callback($local);
        } finally {
            if (is_resource($source)) {
                fclose($source);
            }
            @unlink($local);
        }
    }

    public function delete(EstablishmentImport $import): void
    {
        if ($import->file_path !== null) {
            Storage::disk($import->file_disk)->delete($import->file_path);
        }
    }
}
