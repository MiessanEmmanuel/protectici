<?php

use App\Models\AuditLog;
use App\Models\Feedback;
use App\Models\FeedbackTopic;
use App\Models\IdempotencyKey;
use App\Models\ServiceType;
use App\Models\User;
use App\Notifications\Feedback\FeedbackMail;
use App\Services\Feedback\FeedbackService;
use App\Services\Feedback\VoiceNoteStore;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

/*
| « Dis-moi tout » : commentaire vocal (api-contract §8.2 bis). Aucun vrai fichier audio : de faux conteneurs
| minimaux sont générés en mémoire à partir de leur signature.
*/

const VOICE_FEEDBACKS_URL = '/api/v1/feedbacks';
const VOICE_DISK = 'voice-test';

beforeEach(function () {
    Notification::fake();
    config(['feedback.voice_disk' => VOICE_DISK]);
    Storage::fake(VOICE_DISK);
});

function fakeWebm(int $padding = 64): UploadedFile
{
    return UploadedFile::fake()->createWithContent('enregistrement.webm', "\x1A\x45\xDF\xA3".str_repeat("\x42", $padding));
}

function fakeMp4(): UploadedFile
{
    return UploadedFile::fake()->createWithContent('enregistrement.mp4', "\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00M4A isommp42".str_repeat("\x00", 64));
}

/** @return array<string, mixed> */
function voicePayload(array $overrides = []): array
{
    return array_merge([
        'last_name' => 'Kouassi',
        'first_name' => 'Aya',
        'email' => 'aya.kouassi@exemple.test',
        'action_type' => 'complaint',
        'target_type' => 'service',
        'service_type_id' => ServiceType::factory()->create(['is_visible' => true])->id,
        'topic_id' => FeedbackTopic::factory()->create(['is_visible' => true])->id,
        'voice' => fakeWebm(),
        'voice_duration_seconds' => 42,
        'consent' => '1',
    ], $overrides);
}

function postVoice(array $payload, array $headers = []): TestResponse
{
    return test()->withHeaders($headers + ['Accept' => 'application/json'])->post(VOICE_FEEDBACKS_URL, $payload);
}

it('accepte un message vocal seul (multipart) : fichier privé, colonnes remplies, accusé avec mention du vocal', function () {
    $response = postVoice(voicePayload())->assertCreated();

    $feedback = Feedback::query()->sole();
    expect($feedback->reference)->toBe($response->json('data.reference'))
        ->and($feedback->comment)->toBeNull()
        ->and($feedback->voice_disk)->toBe(VOICE_DISK)
        ->and($feedback->voice_mime)->toBe('audio/webm')
        ->and($feedback->voice_size_bytes)->toBe(68)
        ->and($feedback->voice_duration_seconds)->toBe(42)
        ->and($feedback->voice_path)->toMatch('#^feedback-voice/'.$feedback->id.'/[0-9a-z]{26}\.webm$#')
        ->and($feedback->voice_path)->not->toContain('enregistrement');
    Storage::disk(VOICE_DISK)->assertExists($feedback->voice_path);
    expect(Storage::disk(VOICE_DISK)->getVisibility($feedback->voice_path))->toBe('private');

    // Les colonnes voice_* ne sont jamais sérialisées ni remplissables par le client.
    expect($feedback->toArray())->not->toHaveKey('voice_path')->not->toHaveKey('voice_disk');

    Notification::assertSentOnDemand(FeedbackMail::class, function (FeedbackMail $mail) {
        $lines = implode("\n", $mail->toMail(new stdClass)->introLines);

        return $mail->withVoice && str_contains($lines, 'Votre message vocal a bien été reçu.');
    });
});

it('accepte commentaire et vocal ensemble ; sans vocal, aucune mention dans l\'accusé', function () {
    postVoice(voicePayload(['comment' => 'Le vigile était absent ce matin à six heures.']))->assertCreated();
    expect(Feedback::query()->sole()->comment)->toBe('Le vigile était absent ce matin à six heures.');

    test()->postJson(VOICE_FEEDBACKS_URL, array_diff_key(voicePayload(['comment' => 'Un commentaire écrit seulement, sans vocal.', 'email' => 'autre@exemple.test']), ['voice' => 1, 'voice_duration_seconds' => 1]))->assertCreated();
    $written = Feedback::query()->where('email', 'autre@exemple.test')->sole();
    expect($written->voice_path)->toBeNull()->and($written->voice_mime)->toBeNull();
    Notification::assertSentOnDemand(FeedbackMail::class, fn (FeedbackMail $m, array $c, $n) => $n->routes['mail'] === 'autre@exemple.test' && ! $m->withVoice
        && ! str_contains(implode("\n", $m->toMail(new stdClass)->introLines), 'vocal'));
});

it('accepte un enregistrement MP4 de Safari (normalisé en audio/mp4, extension m4a)', function () {
    postVoice(voicePayload(['voice' => fakeMp4()]))->assertCreated();
    $feedback = Feedback::query()->sole();
    expect($feedback->voice_mime)->toBe('audio/mp4')->and($feedback->voice_path)->toEndWith('.m4a');
});

it('accepte un enregistrement Ogg', function () {
    postVoice(voicePayload(['voice' => UploadedFile::fake()->createWithContent('voix.ogg', 'OggS'.str_repeat("\x00", 40))]))->assertCreated();
    expect(Feedback::query()->sole()->voice_mime)->toBe('audio/ogg');
});

it('refuse l\'envoi sans commentaire ni vocal', function () {
    $payload = array_diff_key(voicePayload(), ['voice' => 1, 'voice_duration_seconds' => 1]);
    test()->postJson(VOICE_FEEDBACKS_URL, $payload)->assertUnprocessable()
        ->assertJsonValidationErrors(['comment' => 'Écrivez un commentaire ou enregistrez un message vocal.']);
    expect(Feedback::query()->count())->toBe(0);
});

it('refuse un fichier qui n\'est pas un enregistrement audio autorisé (type détecté par le contenu)', function (UploadedFile $file) {
    postVoice(voicePayload(['voice' => $file]))->assertUnprocessable()
        ->assertJsonValidationErrors(['voice' => VoiceNoteStore::INVALID]);
    expect(Feedback::query()->count())->toBe(0)->and(IdempotencyKey::query()->count())->toBe(0)
        ->and(Storage::disk(VOICE_DISK)->allFiles())->toBe([]);
    Notification::assertNothingSent();
})->with([
    'PNG renommé en .webm' => fn () => UploadedFile::fake()->createWithContent('voix.webm', "\x89PNG\r\n\x1a\n".str_repeat("\x00", 64)),
    'texte' => fn () => UploadedFile::fake()->createWithContent('voix.webm', str_repeat('Bonjour, ceci est un texte. ', 4)),
    'fichier minuscule' => fn () => UploadedFile::fake()->createWithContent('voix.webm', "\x1A\x45\xDF\xA3"),
]);

it('refuse un vocal de plus de 5 Mo', function () {
    $big = UploadedFile::fake()->createWithContent('voix.webm', "\x1A\x45\xDF\xA3".str_repeat("\x00", 5 * 1024 * 1024));
    postVoice(voicePayload(['voice' => $big]))->assertUnprocessable()
        ->assertJsonValidationErrors(['voice' => VoiceNoteStore::INVALID]);
    expect(Feedback::query()->count())->toBe(0);
});

it('exige une durée entière entre 1 et 120 secondes avec un vocal', function (mixed $duration) {
    $payload = voicePayload(['voice_duration_seconds' => $duration]);
    if ($duration === null) {
        unset($payload['voice_duration_seconds']);
    }
    postVoice($payload)->assertUnprocessable()->assertJsonValidationErrors(['voice_duration_seconds']);
    expect(Feedback::query()->count())->toBe(0);
})->with(['absente' => null, 'zéro' => 0, 'trop longue' => 121, 'non entière' => 'abc']);

it('idempotence : même clé + même fichier = un seul dossier et un seul fichier ; autre fichier = conflit', function () {
    $payload = voicePayload();
    $first = postVoice($payload, ['Idempotency-Key' => 'cle-vocal-00001'])->assertCreated();
    $payload['voice'] = UploadedFile::fake()->createWithContent('enregistrement.webm', "\x1A\x45\xDF\xA3".str_repeat("\x42", 64));
    $second = postVoice($payload, ['Idempotency-Key' => 'cle-vocal-00001'])->assertCreated();

    expect($second->json('data.reference'))->toBe($first->json('data.reference'))
        ->and(Feedback::query()->count())->toBe(1)
        ->and(Storage::disk(VOICE_DISK)->allFiles())->toHaveCount(1);

    $payload['voice'] = fakeWebm(65);
    postVoice($payload, ['Idempotency-Key' => 'cle-vocal-00001'])->assertUnprocessable()->assertJsonValidationErrors(['idempotency_key']);
    expect(Storage::disk(VOICE_DISK)->allFiles())->toHaveCount(1);
});

it('échec d\'écriture : aucune ligne créée, aucun fichier laissé', function () {
    $store = Mockery::mock(VoiceNoteStore::class)->makePartial();
    $store->shouldReceive('store')->andThrow(new RuntimeException('disque plein'));
    app()->instance(VoiceNoteStore::class, $store);
    $this->withoutExceptionHandling();

    expect(fn () => postVoice(voicePayload()))->toThrow(RuntimeException::class);
    expect(Feedback::withTrashed()->count())->toBe(0)->and(IdempotencyKey::query()->count())->toBe(0)
        ->and(Storage::disk(VOICE_DISK)->allFiles())->toBe([]);
});

it('échec après écriture (insert annulé) : le fichier écrit est supprimé', function () {
    // Une contrainte en base échoue APRÈS l'écriture du fichier (durée hors bornes forcée au niveau du service).
    $service = app(FeedbackService::class);
    $data = array_diff_key(voicePayload(), ['voice' => 1, 'consent' => 1]);
    $data['voice_duration_seconds'] = 999;

    expect(fn () => $service->create(null, $data, null, '127.0.0.1', fakeWebm()))->toThrow(QueryException::class);
    expect(Feedback::withTrashed()->count())->toBe(0)->and(Storage::disk(VOICE_DISK)->allFiles())->toBe([]);
});

it('suivi public : aucune information sur le vocal', function () {
    $reference = postVoice(voicePayload())->assertCreated()->json('data.reference');

    $response = test()->postJson('/api/v1/feedbacks/track', ['reference' => $reference, 'email' => 'aya.kouassi@exemple.test'])->assertOk();
    expect($response->json('data'))->not->toHaveKey('voice')
        ->and($response->getContent())->not->toContain('voice')->not->toContain('audio')->not->toContain('feedback-voice');
});

it('admin : métadonnées du vocal dans la liste et le détail, null sans vocal', function () {
    $admin = makeAdmin();
    postVoice(voicePayload())->assertCreated();
    $feedback = Feedback::query()->sole();
    $plain = Feedback::factory()->create();

    $expected = ['duration_seconds' => 42, 'mime' => 'audio/webm', 'size_bytes' => 68];
    $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks/'.$feedback->id)->assertOk()->assertJsonPath('data.voice', $expected)
        ->assertJsonMissingPath('data.voice.path');
    $list = $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks')->assertOk();
    expect(collect($list->json('data'))->firstWhere('id', $feedback->id)['voice'])->toBe($expected)
        ->and(collect($list->json('data'))->firstWhere('id', $plain->id)['voice'])->toBeNull()
        ->and($list->getContent())->not->toContain('feedback-voice');
});

it('admin : écoute du vocal (binaire, en-têtes du contrat, accès journalisé sans donnée personnelle)', function () {
    $admin = makeAdmin();
    postVoice(voicePayload())->assertCreated();
    $feedback = Feedback::query()->sole();

    $response = $this->actingAs($admin)->get('/api/v1/admin/feedbacks/'.$feedback->id.'/voice')->assertOk();

    expect($response->streamedContent())->toBe("\x1A\x45\xDF\xA3".str_repeat("\x42", 64))
        ->and($response->headers->get('Content-Type'))->toStartWith('audio/webm')
        ->and($response->headers->get('Content-Disposition'))->toBe('inline; filename="'.$feedback->reference.'.webm"')
        ->and($response->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
        ->and($response->headers->get('X-Content-Type-Options'))->toBe('nosniff');

    $log = AuditLog::query()->where('event', 'feedback_voice_accessed')->sole();
    expect($log->user_id)->toBe($admin->id)->and($log->auditable_id)->toBe($feedback->id);
    expect(json_encode($log->toArray()))->not->toContain('aya.kouassi')->not->toContain('Kouassi')->not->toContain('feedback-voice');
});

it('admin : 404 JSON si le dossier n\'a pas de vocal, ou si le fichier a disparu', function () {
    $admin = makeAdmin();
    $plain = Feedback::factory()->create();
    $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks/'.$plain->id.'/voice')->assertNotFound()->assertJsonStructure(['message']);
    $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks/999999/voice')->assertNotFound();

    postVoice(voicePayload())->assertCreated();
    $voiced = Feedback::query()->whereNotNull('voice_path')->sole();
    Storage::disk(VOICE_DISK)->delete($voiced->voice_path);
    $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks/'.$voiced->id.'/voice')->assertNotFound();
    expect(AuditLog::query()->where('event', 'feedback_voice_accessed')->count())->toBe(0);
});

it('écoute réservée à l\'administration (401 invité, 403 autres rôles ou admin sans 2FA)', function () {
    postVoice(voicePayload())->assertCreated();
    $url = '/api/v1/admin/feedbacks/'.Feedback::query()->sole()->id.'/voice';

    test()->getJson($url)->assertUnauthorized();
    foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), User::factory()->admin()->create()] as $actor) {
        $this->actingAs($actor)->getJson($url)->assertForbidden();
    }
    expect(AuditLog::query()->where('event', 'feedback_voice_accessed')->count())->toBe(0);
});

it('rétention : l\'anonymisation supprime le fichier vocal et vide les colonnes, dossiers déjà anonymisés compris', function () {
    $disk = Storage::disk(VOICE_DISK);
    $make = function (array $attributes) use ($disk): Feedback {
        $feedback = Feedback::factory()->resolvedAt(now()->subMonthsNoOverflow(40))->create($attributes);
        $path = 'feedback-voice/'.$feedback->id.'/01jabcdefghijklmnopqrstuvw.webm';
        $disk->put($path, "\x1A\x45\xDF\xA3voix");
        $feedback->forceFill(['voice_disk' => VOICE_DISK, 'voice_path' => $path, 'voice_mime' => 'audio/webm', 'voice_size_bytes' => 8, 'voice_duration_seconds' => 5])->save();

        return $feedback;
    };

    $old = $make([]);
    $alreadyAnonymous = $make(['first_name' => 'Anonymisé', 'last_name' => 'Anonymisé', 'email' => null, 'phone' => null, 'civility' => null, 'ip_hash' => null]);
    $recent = Feedback::factory()->resolvedAt(now()->subMonthsNoOverflow(10))->create();
    $recentPath = 'feedback-voice/'.$recent->id.'/recent.webm';
    $disk->put($recentPath, 'x');
    $recent->forceFill(['voice_disk' => VOICE_DISK, 'voice_path' => $recentPath, 'voice_mime' => 'audio/webm', 'voice_size_bytes' => 1, 'voice_duration_seconds' => 3])->save();
    $oldPath = $old->voice_path;
    $anonPath = $alreadyAnonymous->voice_path;

    $this->artisan('retention:anonymize-feedbacks')->assertSuccessful();

    foreach ([$old, $alreadyAnonymous] as $feedback) {
        $feedback->refresh();
        expect([$feedback->voice_disk, $feedback->voice_path, $feedback->voice_mime, $feedback->voice_size_bytes, $feedback->voice_duration_seconds])
            ->toBe([null, null, null, null, null])
            ->and($feedback->email)->toBeNull();
    }
    $disk->assertMissing($oldPath);
    $disk->assertMissing($anonPath);
    $disk->assertExists($recentPath);
    expect($recent->refresh()->voice_path)->toBe($recentPath);

    // Seconde exécution : plus rien à faire.
    $this->artisan('retention:anonymize-feedbacks')->assertSuccessful();
    expect(AuditLog::query()->where('event', 'retention_anonymize')->count())->toBe(1);
});

it('suppression définitive d\'un dossier : le fichier vocal est supprimé', function () {
    postVoice(voicePayload())->assertCreated();
    $feedback = Feedback::query()->sole();
    $path = $feedback->voice_path;

    $feedback->delete(); // suppression logique : le fichier reste (dossier restaurable)
    Storage::disk(VOICE_DISK)->assertExists($path);
    $feedback->forceDelete();
    Storage::disk(VOICE_DISK)->assertMissing($path);
});
