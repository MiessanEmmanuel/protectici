<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\Media;
use App\Models\Provider;
use App\Models\ProviderDocument;
use App\Models\StateForce;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Carbon::setTestNow('2026-10-09 12:00:00');
    Storage::fake('public');
    Storage::fake('private');
});
afterEach(fn () => Carbon::setTestNow());

function retentionProvider(?Carbon $deletedAt): Provider
{
    $p = Provider::factory()->create(['city_id' => City::factory()->create()->id, 'user_id' => null]);
    if ($deletedAt) {
        $p->forceFill(['deleted_at' => $deletedAt])->save();
    }

    return $p;
}

function retentionDoc(Provider|StateForce $e, string $name): ProviderDocument
{
    Storage::disk('private')->put("documents/{$name}.pdf", '%PDF-1.4');

    return ProviderDocument::create([
        $e instanceof Provider ? 'provider_id' : 'state_force_id' => $e->id, 'type' => 'rccm_extract', 'disk' => 'private',
        'path' => "documents/{$name}.pdf", 'original_name' => 'secret-nom.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 8,
    ]);
}

function retentionMedia(Provider|StateForce $e, string $name, string $collection = 'logo'): Media
{
    Storage::disk('public')->put("media/{$name}.webp", 'x');

    return Media::create([
        'mediable_type' => $e->getMorphClass(), 'mediable_id' => $e->id, 'collection' => $collection, 'disk' => 'public',
        'path' => "media/{$name}.webp", 'original_name' => 'a.webp', 'mime_type' => 'image/webp', 'size_bytes' => 1, 'alt_text' => 'x',
    ]);
}

it('supprime physiquement fichiers et lignes des fiches supprimées depuis plus de 30 jours (seuil 29 / 31 jours)', function () {
    $old = retentionProvider(now()->subDays(31));
    $recent = retentionProvider(now()->subDays(29));
    $live = retentionProvider(null);
    $force = StateForce::factory()->create(['city_id' => City::factory()->create()->id]);
    $force->forceFill(['deleted_at' => now()->subDays(40)])->save();

    $oldDoc = retentionDoc($old, 'old');
    $recentDoc = retentionDoc($recent, 'recent');
    $liveDoc = retentionDoc($live, 'live');
    $forceDoc = retentionDoc($force, 'force');
    $oldLogo = retentionMedia($old, 'old-logo');
    $oldGallery = retentionMedia($old, 'old-gal', 'gallery');
    $oldGallery->delete(); // déjà soft-deleted (ligne trashed d'une fiche trashed)
    $forceCover = retentionMedia($force, 'force-cover', 'cover');
    $recentLogo = retentionMedia($recent, 'recent-logo');
    $liveLogo = retentionMedia($live, 'live-logo');

    $this->artisan('retention:purge-establishment-files')->assertSuccessful();

    foreach (['documents/old.pdf', 'documents/force.pdf'] as $gone) {
        Storage::disk('private')->assertMissing($gone);
    }
    foreach (['media/old-logo.webp', 'media/old-gal.webp', 'media/force-cover.webp'] as $gone) {
        Storage::disk('public')->assertMissing($gone);
    }
    Storage::disk('private')->assertExists('documents/recent.pdf');
    Storage::disk('private')->assertExists('documents/live.pdf');
    Storage::disk('public')->assertExists('media/recent-logo.webp');
    Storage::disk('public')->assertExists('media/live-logo.webp');

    expect(ProviderDocument::withTrashed()->pluck('id')->sort()->values()->all())->toBe([$recentDoc->id, $liveDoc->id])
        ->and(Media::withTrashed()->pluck('id')->sort()->values()->all())->toBe([$recentLogo->id, $liveLogo->id]);
    unset($oldDoc, $forceDoc, $oldLogo, $forceCover);

    $log = AuditLog::where('event', 'retention_purge')->sole();
    expect($log->context)->toMatchArray(['command' => 'retention:purge-establishment-files', 'count' => 5]);
    expect(json_encode($log->toArray()))->not->toContain('secret-nom');
});

it('supprime aussi les justificatifs et médias eux-mêmes supprimés logiquement depuis plus de 30 jours', function () {
    $live = retentionProvider(null);
    $oldDoc = retentionDoc($live, 'doc-old');
    $oldDoc->forceFill(['deleted_at' => now()->subDays(31)])->save();
    $freshDoc = retentionDoc($live, 'doc-fresh');
    $freshDoc->forceFill(['deleted_at' => now()->subDays(29)])->save();
    $oldMedia = retentionMedia($live, 'm-old');
    $oldMedia->forceFill(['deleted_at' => now()->subDays(45)])->save();

    $this->artisan('retention:purge-establishment-files')->assertSuccessful();

    Storage::disk('private')->assertMissing('documents/doc-old.pdf');
    Storage::disk('private')->assertExists('documents/doc-fresh.pdf');
    Storage::disk('public')->assertMissing('media/m-old.webp');
    expect(ProviderDocument::withTrashed()->pluck('id')->all())->toBe([$freshDoc->id])->and(Media::withTrashed()->count())->toBe(0);
});

it('ne plante pas si le fichier est déjà absent du disque, et reste idempotent', function () {
    $old = retentionProvider(now()->subDays(60));
    $doc = retentionDoc($old, 'ghost');
    Storage::disk('private')->delete($doc->path);

    $this->artisan('retention:purge-establishment-files')->assertSuccessful();
    $this->artisan('retention:purge-establishment-files')->assertSuccessful();

    expect(ProviderDocument::withTrashed()->count())->toBe(0)->and(AuditLog::where('event', 'retention_purge')->count())->toBe(1);
});

it('ne fait rien et n\'écrit aucun audit quand rien n\'est à purger', function () {
    retentionDoc(retentionProvider(null), 'safe');
    $this->artisan('retention:purge-establishment-files')->assertSuccessful();
    expect(AuditLog::where('event', 'retention_purge')->count())->toBe(0);
    Storage::disk('private')->assertExists('documents/safe.pdf');
});

it('planifie les cinq commandes de rétention, une exécution à la fois', function () {
    $events = collect(Schedule::events())->filter(fn ($e) => str_contains($e->command, 'retention:'));
    expect($events)->toHaveCount(5);
    foreach ($events as $event) {
        expect($event->onOneServer)->toBeTrue()->and($event->withoutOverlapping)->toBeTrue();
    }
    $this->artisan('schedule:list')->expectsOutputToContain('retention:purge-establishment-files')->assertSuccessful();
});
