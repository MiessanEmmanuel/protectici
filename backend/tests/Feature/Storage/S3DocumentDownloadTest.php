<?php

use App\Models\AuditLog;
use App\Models\ProviderDocument;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/** Disque S3-compatible factice : la signature se calcule en local, aucun appel réseau. */
function fakeS3Private(): void
{
    config(['filesystems.disks.s3-private' => [
        'driver' => 's3', 'key' => 'AKIATESTKEY', 'secret' => 'secret-bidon', 'region' => 'auto',
        'bucket' => 'protectici-private-test', 'endpoint' => 'https://r2.invalid', 'use_path_style_endpoint' => true,
        'visibility' => 'private', 'throw' => true, 'report' => false,
    ]]);
    Storage::forgetDisk('s3-private');
}

function s3Doc(): ProviderDocument
{
    $p = pendingProviderOf(User::factory()->create());

    return ProviderDocument::query()->create([
        'provider_id' => $p->id, 'type' => 'rccm_extract', 'disk' => 's3-private', 'path' => 'documents/provider/1/abc.pdf',
        'original_name' => 'a.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 12,
    ]);
}

it('redirige vers une URL signée courte, en pièce jointe, sans appel réseau, et journalise', function () {
    fakeS3Private();
    $admin = makeAdmin();
    $doc = s3Doc();

    $res = $this->actingAs($admin)->get('/api/v1/admin/documents/'.$doc->id.'/download')->assertStatus(302);

    $location = $res->headers->get('Location');
    expect($location)->toStartWith('https://r2.invalid/protectici-private-test/documents/provider/1/abc.pdf?');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $q);
    expect($q)->toHaveKeys(['X-Amz-Signature', 'X-Amz-Expires', 'X-Amz-Credential'])
        ->and((int) $q['X-Amz-Expires'])->toBeGreaterThan(0)->toBeLessThanOrEqual(600)
        ->and((int) $q['X-Amz-Expires'])->toBe(300)
        ->and($q['response-content-disposition'])->toBe('attachment; filename="justificatif-'.$doc->id.'.pdf"')
        ->and($q['response-content-type'])->toBe('application/pdf');
    expect($res->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');

    $log = AuditLog::where('event', 'document_downloaded')->sole();
    expect($log->user_id)->toBe($admin->id)->and($log->context['document_id'])->toBe($doc->id);
    expect(json_encode($log->toArray()))->not->toContain('X-Amz-Signature');
});

it('plafonne la durée de validité à 10 minutes', function () {
    fakeS3Private();
    config(['establishments.documents.signed_url_ttl_minutes' => 999]);
    $doc = s3Doc();

    $res = $this->actingAs(makeAdmin())->get('/api/v1/admin/documents/'.$doc->id.'/download')->assertStatus(302);
    parse_str((string) parse_url($res->headers->get('Location'), PHP_URL_QUERY), $q);
    expect((int) $q['X-Amz-Expires'])->toBe(600);
});

it('contrôle l\'autorisation avant toute signature : anonyme 401, user/provider 403, sans audit', function () {
    fakeS3Private();
    $doc = s3Doc();
    $url = '/api/v1/admin/documents/'.$doc->id.'/download';

    $this->getJson($url)->assertUnauthorized();
    foreach ([User::factory()->create(), User::factory()->provider()->create()] as $actor) {
        $res = $this->actingAs($actor)->getJson($url)->assertForbidden();
        expect($res->headers->get('Location'))->toBeNull();
    }
    expect(AuditLog::where('event', 'document_downloaded')->count())->toBe(0);
    $this->actingAs(makeAdmin())->getJson('/api/v1/admin/documents/999999/download')->assertNotFound();
});

it('boot de l\'application avec les disques S3 non configurés', function () {
    $this->artisan('about')->assertSuccessful();
    expect(config('filesystems.disks.s3-private.visibility'))->toBe('private')
        ->and(config('filesystems.disks.s3.region'))->toBe('auto')
        ->and(config('establishments.documents.signed_url_ttl_minutes'))->toBe(5);
});
