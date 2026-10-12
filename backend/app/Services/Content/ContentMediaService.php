<?php

namespace App\Services\Content;

use App\Models\Media;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Media\ImageProcessor;
use App\Services\Media\MediaManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Médiathèque éditoriale : images réencodées en WebP (ImageProcessor), nom aléatoire. Le média appartient d'abord à
 * l'utilisateur qui l'envoie (collection `content`) puis est rattaché à l'article ou au partenaire qui l'utilise.
 */
class ContentMediaService
{
    public function __construct(private readonly ImageProcessor $images, private readonly AuditLogger $audit) {}

    public function store(User $uploader, UploadedFile $file, string $alt): Media
    {
        $image = $this->images->process($file, MediaManager::MIMES, (int) config('establishments.media.max_edge.cover', 2400));
        $disk = (string) config('establishments.media_disk');
        $path = "content/{$uploader->id}/".Str::lower((string) Str::ulid()).'.'.$image['extension'];

        Storage::disk($disk)->put($path, $image['binary'], 'public');

        try {
            $media = (new Media)->fill([
                'mediable_type' => $uploader->getMorphClass(),
                'mediable_id' => $uploader->getKey(),
                'collection' => 'content',
                'disk' => $disk,
                'path' => $path,
                'original_name' => Str::limit(preg_replace('/[^\p{L}\p{N}._ -]/u', '', basename(str_replace('\\', '/', $file->getClientOriginalName()))) ?: 'image', 200, ''),
                'mime_type' => $image['mime'],
                'size_bytes' => strlen($image['binary']),
                'width' => $image['width'],
                'height' => $image['height'],
                'alt_text' => $alt,
                'sort_order' => 0,
            ]);
            $media->save();
        } catch (\Throwable $e) {
            Storage::disk($disk)->delete($path);
            throw $e;
        }

        $this->audit->record('content_media_uploaded', null, context: ['media_id' => $media->id], actor: $uploader);

        return $media;
    }

    /**
     * Rattache une image de la médiathèque (envoyée par l'utilisateur lui-même) à un contenu, dans la collection
     * donnée, en remplaçant la précédente. `null` détache. Une image déjà rattachée à ce contenu est conservée.
     */
    public function attach(Model $owner, User $actor, mixed $mediaId, string $collection, string $field): void
    {
        $existing = fn () => Media::query()->where('mediable_type', $owner->getMorphClass())->where('mediable_id', $owner->getKey())->where('collection', $collection);

        if ($mediaId === null) {
            $existing()->get()->each->delete();

            return;
        }

        $media = Media::query()->whereKey((int) $mediaId)->where('collection', 'content')
            ->where('mediable_type', $actor->getMorphClass())->where('mediable_id', $actor->getKey())->first();
        if ($media === null) {
            if ($existing()->whereKey((int) $mediaId)->exists()) {
                return;
            }
            throw ValidationException::withMessages([$field => ['L\'image sélectionnée est introuvable.']]);
        }

        $existing()->get()->each->delete();
        $media->forceFill(['mediable_type' => $owner->getMorphClass(), 'mediable_id' => $owner->getKey(), 'collection' => $collection])->save();
    }
}
