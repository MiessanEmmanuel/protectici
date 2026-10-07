<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\Provider;
use App\Models\Review;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/** Exécute dans un savepoint pour que l'échec SQL n'invalide pas la transaction du test. */
function inSavepoint(Closure $callback): mixed
{
    return DB::transaction($callback);
}

it('publication ⇒ approuvé : refuse is_visible sur une fiche non approuvée (providers, state_forces)', function (string $status) {
    $city = City::factory()->create();

    expect(fn () => inSavepoint(fn () => Provider::factory()->create(['city_id' => $city->id, 'status' => $status, 'is_visible' => true])))
        ->toThrow(QueryException::class, 'providers_publish_requires_approved_chk');
    expect(fn () => inSavepoint(fn () => StateForce::factory()->create(['city_id' => $city->id, 'status' => $status, 'is_visible' => true])))
        ->toThrow(QueryException::class, 'state_forces_publish_requires_approved_chk');
})->with(['pending', 'draft', 'rejected', 'suspended']);

it('refuse un avis visible non approuvé', function () {
    expect(fn () => inSavepoint(fn () => Review::factory()->create(['status' => 'pending', 'is_visible' => true])))
        ->toThrow(QueryException::class, 'reviews_publish_requires_approved_chk');
});

it('impose un motif de rejet, des coordonnées par paire et une note 1-5', function () {
    $city = City::factory()->create();

    expect(fn () => inSavepoint(fn () => Provider::factory()->create(['city_id' => $city->id, 'status' => 'rejected', 'is_visible' => false, 'rejection_reason' => null])))
        ->toThrow(QueryException::class, 'rejection_reason_chk');
    expect(fn () => inSavepoint(fn () => Provider::factory()->create(['city_id' => $city->id, 'latitude' => 5.3, 'longitude' => null])))
        ->toThrow(QueryException::class, 'lat_lng_pair_chk');
    expect(fn () => inSavepoint(fn () => Provider::factory()->create(['city_id' => $city->id, 'latitude' => 95, 'longitude' => 0])))
        ->toThrow(QueryException::class, 'lat_range_chk');
    expect(fn () => inSavepoint(fn () => Review::factory()->create(['rating' => 6])))->toThrow(QueryException::class, 'rating_chk');
    expect(fn () => inSavepoint(fn () => Review::factory()->create(['body' => 'court'])))->toThrow(QueryException::class, 'body_length_chk');
    expect(fn () => inSavepoint(fn () => User::factory()->create(['role' => 'superadmin'])))->toThrow(QueryException::class, 'role_chk');
});

it('un seul avis par utilisateur et par prestataire (hors avis supprimés)', function () {
    $provider = makeProvider();
    $user = User::factory()->create();
    $first = Review::factory()->create(['provider_id' => $provider->id, 'user_id' => $user->id]);

    expect(fn () => inSavepoint(fn () => Review::factory()->create(['provider_id' => $provider->id, 'user_id' => $user->id])))
        ->toThrow(UniqueConstraintViolationException::class);

    // Autre utilisateur ou autre prestataire : autorisé.
    Review::factory()->create(['provider_id' => $provider->id]);
    Review::factory()->create(['user_id' => $user->id]);

    // Après suppression logique, l'utilisateur peut redonner un avis.
    $first->delete();
    Review::factory()->create(['provider_id' => $provider->id, 'user_id' => $user->id]);
    expect(Review::where('provider_id', $provider->id)->where('user_id', $user->id)->count())->toBe(1);
});

it('unicité du RCCM et du numéro d\'agrément', function () {
    makeProvider(['rccm' => 'RCCM-1', 'approval_number' => 'AGR-1']);

    expect(fn () => inSavepoint(fn () => makeProvider(['rccm' => 'RCCM-1'])))->toThrow(UniqueConstraintViolationException::class);
    expect(fn () => inSavepoint(fn () => makeProvider(['approval_number' => 'AGR-1'])))->toThrow(UniqueConstraintViolationException::class);
    makeProvider(['rccm' => null]);
    makeProvider(['rccm' => null]);
});

it('trigger : la note moyenne suit les avis approuvés, visibles et non supprimés', function () {
    $provider = makeProvider();
    $a = Review::factory()->rating(5)->create(['provider_id' => $provider->id]);
    $b = Review::factory()->rating(2)->create(['provider_id' => $provider->id]);
    Review::factory()->pending()->rating(1)->create(['provider_id' => $provider->id]);

    $fresh = $provider->fresh();
    expect((float) $fresh->rating_avg)->toBe(3.5)->and($fresh->rating_count)->toBe(2);

    // Modération : rejet d'un avis => recalcul
    $b->forceFill(['status' => 'rejected', 'is_visible' => false])->save();
    expect((float) $provider->fresh()->rating_avg)->toBe(5.0)->and($provider->fresh()->rating_count)->toBe(1);

    // Suppression logique
    $a->delete();
    expect((float) $provider->fresh()->rating_avg)->toBe(0.0)->and($provider->fresh()->rating_count)->toBe(0);

    // Suppression physique et changement de prestataire
    $c = Review::factory()->rating(4)->create(['provider_id' => $provider->id]);
    $other = makeProvider();
    $c->forceFill(['provider_id' => $other->id])->save();
    expect($provider->fresh()->rating_count)->toBe(0)->and($other->fresh()->rating_count)->toBe(1);
    $c->forceDelete();
    expect($other->fresh()->rating_count)->toBe(0);
});

it('trigger : quitter « approved » masque automatiquement la fiche', function () {
    $city = City::factory()->create();
    $provider = makeProvider([], $city);
    $force = makeStateForce([], $city);

    $provider->forceFill(['status' => 'suspended'])->save();
    $force->forceFill(['status' => 'suspended'])->save();

    expect($provider->fresh()->is_visible)->toBeFalse()->and($force->fresh()->is_visible)->toBeFalse();
});

it('trigger : search_vector est calculé sans accents', function () {
    $provider = makeProvider(['name' => 'Dauphin Sécurité', 'description' => 'Vidéosurveillance']);

    $count = DB::table('providers')->where('id', $provider->id)
        ->whereRaw("search_vector @@ websearch_to_tsquery('french', unaccent('securite videosurveillance'))")->count();
    expect($count)->toBe(1);

    $provider->forceFill(['name' => 'Nouveau Nom'])->save();
    expect(DB::table('providers')->where('id', $provider->id)->whereRaw("search_vector @@ websearch_to_tsquery('french', 'nouveau')")->count())->toBe(1);
});

it('colonne générée location : calculée depuis latitude/longitude, NULL sans coordonnées', function () {
    $with = makeProvider(['latitude' => 5.3197, 'longitude' => -4.0267]);
    $without = makeProvider(['latitude' => null, 'longitude' => null]);

    $row = DB::selectOne('select ST_X(location::geometry) as x, ST_Y(location::geometry) as y from providers where id = ?', [$with->id]);
    expect(round($row->x, 4))->toBe(-4.0267)->and(round($row->y, 4))->toBe(5.3197);
    expect(DB::selectOne('select location from providers where id = ?', [$without->id])->location)->toBeNull();

    expect(fn () => inSavepoint(fn () => DB::statement('update providers set location = null where id = ?', [$with->id])))->toThrow(QueryException::class);
});

it('audit_logs est immuable (UPDATE, DELETE et TRUNCATE interdits)', function () {
    $log = AuditLog::create(['event' => 'test', 'context' => ['a' => 1]]);

    expect(fn () => inSavepoint(fn () => DB::table('audit_logs')->where('id', $log->id)->update(['event' => 'modifie'])))
        ->toThrow(QueryException::class, 'audit_logs est en ajout seul');
    expect(fn () => inSavepoint(fn () => DB::table('audit_logs')->where('id', $log->id)->delete()))
        ->toThrow(QueryException::class, 'audit_logs est en ajout seul');
    expect(fn () => inSavepoint(fn () => DB::statement('truncate audit_logs')))->toThrow(QueryException::class);
    expect(AuditLog::count())->toBe(1);
});

it('audit_logs : la suppression d\'un utilisateur anonymise uniquement user_id (ON DELETE SET NULL)', function () {
    $user = User::factory()->create();
    $log = AuditLog::create(['user_id' => $user->id, 'event' => 'login']);

    $user->forceDelete();

    expect($log->fresh()->user_id)->toBeNull()->and($log->fresh()->event)->toBe('login');
});

it('fn_next_reference et références par défaut des feedbacks/devis', function () {
    $ref = DB::selectOne("select fn_next_reference('DMT', 'feedback_ref_seq') as r")->r;
    expect($ref)->toMatch('/^DMT-\d{4}-\d{6}$/');

    DB::table('feedbacks')->insert([
        'last_name' => 'Doe', 'first_name' => 'Jane', 'email' => 'jane@example.test', 'action_type' => 'question',
        'target_type' => 'product', 'comment' => 'Un commentaire assez long.', 'consent_at' => now(),
    ]);
    $row = DB::table('feedbacks')->first();
    expect($row->reference)->toMatch('/^DMT-\d{4}-\d{6}$/')->and($row->reference)->not->toBe($ref);
});

it('feedbacks : sujet requis pour employé/prestation', function () {
    expect(fn () => inSavepoint(fn () => DB::table('feedbacks')->insert([
        'last_name' => 'Doe', 'first_name' => 'Jane', 'email' => 'jane@example.test', 'action_type' => 'question',
        'target_type' => 'employee', 'comment' => 'Un commentaire assez long.', 'consent_at' => now(),
    ])))->toThrow(QueryException::class, 'topic_required_chk');
});

it('sp_anonymize_user anonymise le compte et ses liens', function () {
    $user = User::factory()->create(['email' => 'perso@example.test', 'phone' => '+2250700000000']);
    $provider = makeProvider();
    $review = Review::factory()->create(['provider_id' => $provider->id, 'user_id' => $user->id]);
    $user->favoriteProviders()->attach($provider->id);
    DB::table('newsletter_subscribers')->insert(['email' => 'perso@example.test', 'consent_at' => now()]);

    DB::statement('CALL sp_anonymize_user(?)', [$user->id]);

    $row = DB::table('users')->where('id', $user->id)->first();
    expect($row->email)->toBe('anonymise-'.$user->id.'@anonymise.invalid')
        ->and($row->phone)->toBeNull()->and($row->is_active)->toBeFalse()->and($row->two_factor_secret)->toBeNull()
        ->and($row->deleted_at)->not->toBeNull();
    expect($review->fresh()->user_id)->toBeNull();
    expect(DB::table('favorites')->where('user_id', $user->id)->count())->toBe(0);
    expect(DB::table('newsletter_subscribers')->count())->toBe(0);
    expect(AuditLog::where('event', 'user_anonymized')->where('auditable_id', $user->id)->exists())->toBeTrue();
});

it('référentiels : le slug est unique', function () {
    City::factory()->create(['slug' => 'abidjan']);
    expect(fn () => inSavepoint(fn () => City::factory()->create(['slug' => 'abidjan'])))->toThrow(UniqueConstraintViolationException::class);
});

it('le morph map est obligatoire', function () {
    expect((new Provider)->getMorphClass())->toBe('provider');
    expect(fn () => (new class extends Model {})->getMorphClass())->not->toThrow(Throwable::class);
    expect(fn () => Relation::getMorphedModel('inconnu'))->not->toThrow(Throwable::class);
});
