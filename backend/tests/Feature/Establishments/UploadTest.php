<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\Media;
use App\Models\Provider;
use App\Models\ProviderDocument;
use App\Models\StateForce;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    Storage::fake('private');
    config(['establishments.media_disk' => 'public', 'establishments.documents_disk' => 'private']);
    Notification::fake();
});

function mediaUrl(Provider $p): string
{
    return '/api/v1/me/establishments/provider/'.$p->slug.'/media';
}

function docUrl(Provider $p): string
{
    return '/api/v1/me/establishments/provider/'.$p->slug.'/documents';
}

/** JPEG avec un bloc EXIF contenant un GPS factice. */
function jpegWithExif(): string
{
    $img = imagecreatetruecolor(60, 40);
    ob_start();
    imagejpeg($img);
    $jpeg = (string) ob_get_clean();
    $exif = "Exif\0\0MM\0*\0\0\0\x08\0\0\0\0\0\0";
    $app1 = "\xFF\xE1".pack('n', strlen($exif) + 2).$exif;

    return substr($jpeg, 0, 2).$app1.substr($jpeg, 2);
}

it('réencode une image en WebP, nom aléatoire, retire les métadonnées et la renvoie dans l\'API publique', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me, ['status' => 'approved', 'is_visible' => true]);
    $file = UploadedFile::fake()->createWithContent('../../Mon Logo.php.jpg', jpegWithExif());
    expect(str_contains(jpegWithExif(), 'Exif'))->toBeTrue();

    $res = $this->actingAs($me)->post(mediaUrl($p), ['file' => $file, 'collection' => 'logo', 'alt' => 'Logo <b>test</b>'], ['Accept' => 'application/json'])
        ->assertCreated()->assertJsonPath('data.collection', 'logo')->assertJsonPath('data.alt', 'Logo test');

    $media = Media::firstOrFail();
    expect($media->mime_type)->toBe('image/webp')->and($media->path)->toEndWith('.webp')->and($media->path)->not->toContain('Logo')
        ->and($media->original_name)->not->toContain('/');
    $stored = Storage::disk('public')->get($media->path);
    expect(substr($stored, 0, 4))->toBe('RIFF')->and(str_contains($stored, 'Exif'))->toBeFalse();
    expect($res->json('data.url'))->toContain($media->path);

    $this->getJson('/api/v1/providers/'.$p->slug)->assertJsonPath('data.logo_url', $media->url());
    expect(AuditLog::where('event', 'media_uploaded')->count())->toBe(1);
});

it('remplace le logo et borne la galerie à 10 images', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $send = fn (string $c) => $this->actingAs($me)->post(mediaUrl($p), ['file' => UploadedFile::fake()->createWithContent('a.png', pngBytes()), 'collection' => $c, 'alt' => 'Une image'], ['Accept' => 'application/json']);

    $send('logo')->assertCreated();
    $first = Media::firstOrFail()->path;
    $send('logo')->assertCreated();
    expect(Media::count())->toBe(1)->and(Storage::disk('public')->exists($first))->toBeFalse();

    foreach (range(1, 10) as $i) {
        $send('gallery')->assertCreated();
    }
    $send('gallery')->assertUnprocessable()->assertJsonValidationErrors('file');
});

it('refuse faux PDF, exécutable déguisé, SVG, texte et fichier trop gros pour les images', function (string $name, string $content) {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);

    $this->actingAs($me)->post(mediaUrl($p), ['file' => UploadedFile::fake()->createWithContent($name, $content), 'collection' => 'gallery', 'alt' => 'Image'], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors('file');
    expect(Media::count())->toBe(0)->and(Storage::disk('public')->allFiles())->toBe([]);
})->with([
    'faux pdf' => ['facture.png', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"],
    'php déguisé' => ['shell.jpg', '<?php system($_GET["c"]); ?>'],
    'exécutable ELF/MZ' => ['image.png', "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF"],
    'svg' => ['logo.png', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    'gif polyglotte php' => ['x.png', 'GIF89a<?php echo 1; ?>'],
]);

it('valide les champs et la taille des images', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $png = UploadedFile::fake()->createWithContent('a.png', pngBytes());

    $this->actingAs($me)->post(mediaUrl($p), ['file' => $png, 'collection' => 'avatar', 'alt' => 'x1'], ['Accept' => 'application/json'])->assertUnprocessable();
    $this->actingAs($me)->post(mediaUrl($p), ['file' => $png, 'collection' => 'logo'], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('alt');
    $big = UploadedFile::fake()->create('big.jpg', 6000, 'image/jpeg');
    $this->actingAs($me)->post(mediaUrl($p), ['file' => $big, 'collection' => 'logo', 'alt' => 'Trop gros'], ['Accept' => 'application/json'])->assertUnprocessable();
});

it('borne les dimensions de l\'image', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $file = UploadedFile::fake()->createWithContent('large.png', pngBytes(3000, 2000));

    $this->actingAs($me)->post(mediaUrl($p), ['file' => $file, 'collection' => 'logo', 'alt' => 'Grand logo'], ['Accept' => 'application/json'])->assertCreated();
    $m = Media::firstOrFail();
    expect(max($m->width, $m->height))->toBe(1024);
});

it('supprime une image uniquement sur sa propre fiche', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $other = pendingProviderOf($me);
    $this->actingAs($me)->post(mediaUrl($p), ['file' => UploadedFile::fake()->createWithContent('a.png', pngBytes()), 'collection' => 'cover', 'alt' => 'Couverture'], ['Accept' => 'application/json']);
    $m = Media::firstOrFail();

    $this->actingAs($me)->deleteJson(mediaUrl($other).'/'.$m->id)->assertNotFound();
    $this->actingAs($me)->deleteJson(mediaUrl($p).'/'.$m->id)->assertNoContent();
    expect(Media::count())->toBe(0)->and(Storage::disk('public')->allFiles())->toBe([]);
});

it('stocke un justificatif PDF sur le disque privé sans URL, nom aléatoire', function () {
    $me = User::factory()->create();
    $admin = makeAdmin();
    $p = pendingProviderOf($me);
    $pdf = UploadedFile::fake()->createWithContent('../Agrément final.pdf', "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

    $res = $this->actingAs($me)->post(docUrl($p), ['file' => $pdf, 'type' => 'approval_certificate'], ['Accept' => 'application/json'])
        ->assertCreated()->assertJsonStructure(['data' => ['id', 'type', 'original_name', 'size_bytes', 'uploaded_at']]);

    expect($res->json('data'))->not->toHaveKey('url')->not->toHaveKey('path');
    $doc = ProviderDocument::firstOrFail();
    expect($doc->disk)->toBe('private')->and($doc->path)->toEndWith('.pdf')->and($doc->path)->not->toContain('Agr')
        ->and($doc->mime_type)->toBe('application/pdf');
    Storage::disk('private')->assertExists($doc->path);
    Storage::disk('public')->assertMissing($doc->path);
    Notification::assertSentTo($admin, AdminAlert::class, fn ($n) => $n->kind === AdminAlert::KIND_DOCUMENT_UPLOADED);

    $this->actingAs($me)->getJson('/api/v1/me/establishments/provider/'.$p->slug)->assertJsonPath('data.documents.0.id', $doc->id);
    expect(json_encode($this->actingAs($me)->getJson('/api/v1/me/establishments/provider/'.$p->slug)->json()))->not->toContain($doc->path);
});

it('réencode les images-justificatifs (EXIF supprimé) et refuse PDF actif, exécutable, webp', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $post = fn (string $name, string $content, string $type = 'other') => $this->actingAs($me)
        ->post(docUrl($p), ['file' => UploadedFile::fake()->createWithContent($name, $content), 'type' => $type], ['Accept' => 'application/json']);

    $post('cni.jpg', jpegWithExif(), 'id_document')->assertCreated();
    $doc = ProviderDocument::firstOrFail();
    expect($doc->mime_type)->toBe('image/jpeg')->and(str_contains(Storage::disk('private')->get($doc->path), 'Exif'))->toBeFalse();

    $post('actif.pdf', "%PDF-1.4\n1 0 obj<</OpenAction<</S/JavaScript/JS(app.alert(1))>>>>endobj\n%%EOF")->assertUnprocessable();
    $post('virus.pdf', "MZ\x90\x00\x03\x00\x00\x00")->assertUnprocessable();
    $post('page.pdf', '<html><script>1</script></html>')->assertUnprocessable();
    $post('x.pdf', "%PDF-1.4\n%%EOF", 'inconnu')->assertUnprocessable()->assertJsonValidationErrors('type');
    expect(ProviderDocument::count())->toBe(1);
});

it('limite à 5 justificatifs par fiche et permet la suppression', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $send = fn () => $this->actingAs($me)->post(docUrl($p), ['file' => UploadedFile::fake()->createWithContent('a.pdf', "%PDF-1.4\n%%EOF"), 'type' => 'other'], ['Accept' => 'application/json']);
    foreach (range(1, 5) as $i) {
        $send()->assertCreated();
    }
    $send()->assertUnprocessable();
    $doc = ProviderDocument::firstOrFail();
    $this->actingAs($me)->deleteJson(docUrl($p).'/'.$doc->id)->assertNoContent();
    expect(ProviderDocument::count())->toBe(4)->and(Storage::disk('private')->exists($doc->path))->toBeFalse();
});

it('accepte aussi les justificatifs d\'une force étatique', function () {
    $me = User::factory()->create();
    $f = StateForce::factory()->create(['user_id' => $me->id, 'city_id' => City::factory()->create()->id]);
    $this->actingAs($me)->post("/api/v1/me/establishments/state_force/{$f->slug}/documents", ['file' => UploadedFile::fake()->createWithContent('a.pdf', "%PDF-1.4\n%%EOF"), 'type' => 'other'], ['Accept' => 'application/json'])->assertCreated();
    expect(ProviderDocument::firstOrFail()->state_force_id)->toBe($f->id);
});

it('exige l\'authentification pour téléverser', function () {
    $p = pendingProviderOf(User::factory()->create());
    $this->postJson(docUrl($p), [])->assertUnauthorized();
    $this->postJson(mediaUrl($p), [])->assertUnauthorized();
});
