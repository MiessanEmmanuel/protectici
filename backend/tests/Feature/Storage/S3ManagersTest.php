<?php

use App\Models\Media;
use App\Models\ProviderDocument;
use App\Models\User;
use App\Services\Media\DocumentManager;
use App\Services\Media\MediaManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    // Storage::fake remplace les disques par du local : aucun appel réseau, aucun SDK AWS.
    Storage::fake('s3');
    Storage::fake('s3-private');
    config(['establishments.media_disk' => 's3', 'establishments.documents_disk' => 's3-private']);
});

it('envoie et supprime une image publique sur le disque média s3', function () {
    $p = pendingProviderOf(User::factory()->create());
    $file = UploadedFile::fake()->createWithContent('logo.png', pngBytes());

    $media = app(MediaManager::class)->store($p, $file, 'logo', 'Logo');

    expect($media->disk)->toBe('s3');
    Storage::disk('s3')->assertExists($media->path);

    app(MediaManager::class)->destroy($p, $media);
    Storage::disk('s3')->assertMissing($media->path);
    expect(Media::count())->toBe(0);
});

it('envoie et supprime un justificatif sur le disque privé s3-private', function () {
    $p = pendingProviderOf(User::factory()->create());
    $file = UploadedFile::fake()->createWithContent('rccm.pdf', "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");

    $doc = app(DocumentManager::class)->store($p, $file, 'rccm_extract');

    expect($doc->disk)->toBe('s3-private');
    Storage::disk('s3-private')->assertExists($doc->path);
    Storage::disk('s3')->assertMissing($doc->path);

    app(DocumentManager::class)->destroy($p, $doc);
    Storage::disk('s3-private')->assertMissing($doc->path);
    expect(ProviderDocument::count())->toBe(0);
});
