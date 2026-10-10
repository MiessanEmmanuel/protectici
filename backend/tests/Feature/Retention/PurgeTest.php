<?php

use App\Models\AuditLog;
use App\Models\ContactMessage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => Carbon::setTestNow('2026-10-09 12:00:00'));
afterEach(fn () => Carbon::setTestNow());

function idemKey(string $key, Carbon $createdAt): void
{
    DB::table('idempotency_keys')->insert([
        'user_id' => null, 'scope' => 'contact', 'key' => $key, 'request_hash' => str_repeat('a', 64), 'created_at' => $createdAt,
    ]);
}

it('purge les clés d\'idempotence de plus de 48 h uniquement', function () {
    idemKey('recente-47h', now()->subHours(47));
    idemKey('ancienne-49h', now()->subHours(49));
    idemKey('ancienne-10j', now()->subDays(10));

    $this->artisan('retention:purge-idempotency-keys')->assertSuccessful();

    expect(DB::table('idempotency_keys')->pluck('key')->all())->toBe(['recente-47h']);
    $log = AuditLog::where('event', 'retention_purge')->sole();
    expect($log->context)->toMatchArray(['command' => 'retention:purge-idempotency-keys', 'count' => 2])
        ->and($log->context['threshold_date'])->toStartWith('2026-10-07T12:00:00')
        ->and($log->user_id)->toBeNull();
});

it('traite plus de 200 clés par lots', function () {
    foreach (range(1, 450) as $i) {
        idemKey("k{$i}", now()->subDays(3));
    }
    $this->artisan('retention:purge-idempotency-keys')->assertSuccessful();
    expect(DB::table('idempotency_keys')->count())->toBe(0)
        ->and(AuditLog::where('event', 'retention_purge')->sole()->context['count'])->toBe(450);
});

it('purge les messages de contact de plus de 12 mois (11 mois conservés, 13 supprimés)', function () {
    $recent = ContactMessage::factory()->create(['created_at' => now()->subMonthsNoOverflow(11)]);
    ContactMessage::factory()->create(['created_at' => now()->subMonthsNoOverflow(13), 'name' => 'Nom Ancien', 'email' => 'ancien@example.test']);

    $this->artisan('retention:purge-contact-messages')->assertSuccessful();

    expect(ContactMessage::pluck('id')->all())->toBe([$recent->id]);
    $log = AuditLog::where('event', 'retention_purge')->sole();
    expect($log->context['command'])->toBe('retention:purge-contact-messages')->and($log->context['count'])->toBe(1);
    expect(json_encode($log->toArray()))->not->toContain('Nom Ancien')->not->toContain('ancien@example.test');
});

it('est idempotent et n\'écrit pas d\'audit quand il n\'y a rien à faire', function () {
    $this->artisan('retention:purge-idempotency-keys')->assertSuccessful();
    $this->artisan('retention:purge-contact-messages')->assertSuccessful();
    expect(AuditLog::where('event', 'retention_purge')->count())->toBe(0);

    ContactMessage::factory()->create(['created_at' => now()->subMonthsNoOverflow(14)]);
    idemKey('vieille', now()->subDays(5));
    foreach ([1, 2] as $_) {
        $this->artisan('retention:purge-contact-messages')->assertSuccessful();
        $this->artisan('retention:purge-idempotency-keys')->assertSuccessful();
    }
    expect(AuditLog::where('event', 'retention_purge')->count())->toBe(2);
});

it('retention:run enchaîne les cinq commandes', function () {
    idemKey('vieille', now()->subDays(5));
    ContactMessage::factory()->create(['created_at' => now()->subMonthsNoOverflow(14)]);

    $this->artisan('retention:run')->assertSuccessful();

    expect(DB::table('idempotency_keys')->count())->toBe(0)->and(ContactMessage::count())->toBe(0)
        ->and(AuditLog::whereIn('event', ['retention_purge', 'retention_anonymize'])->count())->toBe(2);
});
