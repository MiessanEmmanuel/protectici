<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\Feedback;
use App\Models\Provider;
use App\Models\QuoteRequest;
use App\Models\QuoteRequestRecipient;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(fn () => Carbon::setTestNow('2026-10-09 12:00:00'));
afterEach(fn () => Carbon::setTestNow());

function assertFeedbackAnonymous(Feedback $f): void
{
    $f->refresh();
    expect([$f->first_name, $f->last_name, $f->email, $f->phone, $f->civility, $f->user_id, $f->ip_hash])
        ->toBe(['Anonymisé', 'Anonymisé', null, null, null, null, null]);
}

it('anonymise les feedbacks clos depuis plus de 36 mois et conserve le reste', function () {
    $user = User::factory()->create();
    $old = Feedback::factory()->resolvedAt(now()->subMonthsNoOverflow(37))->create(['user_id' => $user->id, 'first_name' => 'Awa', 'last_name' => 'Kouassi', 'email' => 'awa@example.test']);
    $recent = Feedback::factory()->resolvedAt(now()->subMonthsNoOverflow(35))->create(['email' => 'recent@example.test']);
    $open = Feedback::factory()->create(['created_at' => now()->subYears(6), 'email' => 'ouvert@example.test']);
    $trashed = Feedback::factory()->resolvedAt(now()->subMonthsNoOverflow(40))->create();
    $trashed->delete();

    $this->artisan('retention:anonymize-feedbacks')->assertSuccessful();

    assertFeedbackAnonymous($old);
    expect($old->comment)->toBe('Commentaire factice de plus de dix caractères.')->and($old->status)->toBe('resolved')
        ->and($old->reference)->not->toBeEmpty();
    assertFeedbackAnonymous(Feedback::withTrashed()->findOrFail($trashed->id));
    expect($recent->refresh()->email)->toBe('recent@example.test')->and($open->refresh()->email)->toBe('ouvert@example.test');

    $log = AuditLog::where('event', 'retention_anonymize')->sole();
    expect($log->context)->toMatchArray(['command' => 'retention:anonymize-feedbacks', 'count' => 2]);
    $dump = json_encode($log->toArray());
    expect($dump)->not->toContain('Awa')->not->toContain('Kouassi')->not->toContain('awa@example.test');
});

it('anonymisation des feedbacks idempotente : une seule écriture d\'audit', function () {
    Feedback::factory()->resolvedAt(now()->subMonthsNoOverflow(50))->create();

    $this->artisan('retention:anonymize-feedbacks')->assertSuccessful();
    $this->artisan('retention:anonymize-feedbacks')->assertSuccessful();

    expect(AuditLog::where('event', 'retention_anonymize')->count())->toBe(1);
});

it('anonymise les devis de plus de 24 mois, supprimés logiquement compris, et vide les réponses des destinataires', function () {
    $user = User::factory()->create();
    $old = QuoteRequest::factory()->create(['created_at' => now()->subMonthsNoOverflow(25), 'user_id' => $user->id, 'first_name' => 'Yao', 'email' => 'yao@example.test']);
    $recent = QuoteRequest::factory()->create(['created_at' => now()->subMonthsNoOverflow(23), 'email' => 'recent@example.test']);
    $trashed = QuoteRequest::factory()->create(['created_at' => now()->subMonthsNoOverflow(30)]);
    $trashed->delete();

    $provider = Provider::factory()->create(['city_id' => City::factory()->create()->id]);
    $reply = QuoteRequestRecipient::create(['quote_request_id' => $old->id, 'provider_id' => $provider->id]);
    $reply->forceFill(['response_message' => 'Voici notre offre pour M. Yao'])->save();
    $keep = QuoteRequestRecipient::create(['quote_request_id' => $recent->id, 'provider_id' => $provider->id]);
    $keep->forceFill(['response_message' => 'Offre récente'])->save();

    $this->artisan('retention:anonymize-quote-requests')->assertSuccessful();

    foreach ([$old->refresh(), QuoteRequest::withTrashed()->findOrFail($trashed->id)] as $q) {
        expect([$q->first_name, $q->last_name, $q->email, $q->phone, $q->company_name, $q->user_id, $q->ip_hash, $q->description])
            ->toBe(['Anonymisé', 'Anonymisé', null, 'anonymisé', null, null, null, '[Contenu anonymisé]']);
    }
    expect($recent->refresh()->email)->toBe('recent@example.test')->and($recent->description)->not->toBe('[Contenu anonymisé]')
        ->and($reply->refresh()->response_message)->toBeNull()->and($keep->refresh()->response_message)->toBe('Offre récente');

    $log = AuditLog::where('event', 'retention_anonymize')->sole();
    expect($log->context)->toMatchArray(['command' => 'retention:anonymize-quote-requests', 'count' => 2]);
    expect(json_encode($log->toArray()))->not->toContain('Yao')->not->toContain('yao@example.test');

    $this->artisan('retention:anonymize-quote-requests')->assertSuccessful();
    expect(AuditLog::where('event', 'retention_anonymize')->count())->toBe(1);
});

it('sans donnée à traiter, aucun audit n\'est écrit', function () {
    Feedback::factory()->create();
    QuoteRequest::factory()->create();

    $this->artisan('retention:anonymize-feedbacks')->assertSuccessful();
    $this->artisan('retention:anonymize-quote-requests')->assertSuccessful();

    expect(AuditLog::where('event', 'retention_anonymize')->count())->toBe(0);
});
