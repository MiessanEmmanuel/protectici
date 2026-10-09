<?php

namespace App\Services\Media;

use App\Enums\EstablishmentType;
use App\Models\Media;
use App\Models\Provider;
use App\Models\StateForce;
use App\Services\AuditLogger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Images publiques d'une fiche (logo, couverture, galerie) : réencodées en WebP, nom aléatoire, disque configurable. */
class MediaManager
{
    public const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

    public function __construct(private readonly ImageProcessor $images, private readonly AuditLogger $audit) {}

    public function store(Provider|StateForce $establishment, UploadedFile $file, string $collection, string $alt): Media
    {
        $type = EstablishmentType::tryFromModel($establishment);
        $maxEdge = (int) config("establishments.media.max_edge.{$collection}", 2048);
        $image = $this->images->process($file, self::MIMES, $maxEdge);

        $disk = (string) config('establishments.media_disk');
        $path = "establishments/{$type->value}/{$establishment->id}/{$collection}/".Str::lower((string) Str::ulid()).'.'.$image['extension'];

        $old = [];
        $media = DB::transaction(function () use ($establishment, $collection, $alt, $file, $image, $disk, $path, &$old) {
            // Verrou de la fiche : pas de dépassement de la limite par envois simultanés.
            $establishment::query()->whereKey($establishment->getKey())->lockForUpdate()->first();

            $existing = Media::query()->where('mediable_type', $establishment->getMorphClass())
                ->where('mediable_id', $establishment->getKey())->where('collection', $collection)->get();

            if ($collection === 'gallery' && $existing->count() >= (int) config('establishments.media.gallery_max', 10)) {
                throw ValidationException::withMessages(['file' => ['La galerie est limitée à 10 images.']]);
            }

            if ($collection !== 'gallery') {
                $old = $existing->all();
            }

            Storage::disk($disk)->put($path, $image['binary'], 'public');

            try {
                $media = (new Media)->fill([
                    'mediable_type' => $establishment->getMorphClass(),
                    'mediable_id' => $establishment->getKey(),
                    'collection' => $collection,
                    'disk' => $disk,
                    'path' => $path,
                    'original_name' => $this->safeName($file->getClientOriginalName()),
                    'mime_type' => $image['mime'],
                    'size_bytes' => strlen($image['binary']),
                    'width' => $image['width'],
                    'height' => $image['height'],
                    'alt_text' => $alt,
                    'sort_order' => $existing->count(),
                ]);
                $media->save();

                foreach ($old as $previous) {
                    $previous->delete();
                }
            } catch (\Throwable $e) {
                Storage::disk($disk)->delete($path);
                throw $e;
            }

            $this->audit->record('media_uploaded', $establishment, null, null, ['collection' => $collection]);

            return $media;
        });

        foreach ($old as $previous) {
            Storage::disk($previous->disk)->delete($previous->path);
        }

        return $media;
    }

    public function destroy(Provider|StateForce $establishment, Media $media): void
    {
        DB::transaction(function () use ($establishment, $media) {
            $media->delete();
            $this->audit->record('media_deleted', $establishment, null, null, ['collection' => $media->collection]);
        });
        Storage::disk($media->disk)->delete($media->path);
    }

    private function safeName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[^\p{L}\p{N}._ -]/u', '', $name) ?? '';

        return Str::limit($name !== '' ? $name : 'image', 200, '');
    }
}
