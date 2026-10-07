<?php

use App\Models\Provider;
use App\Models\Review;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Support\Facades\Gate;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->editor = User::factory()->editor()->create();
    $this->owner = User::factory()->provider()->create();
    $this->stranger = User::factory()->provider()->create();
    $this->member = User::factory()->create();
});

it('ProviderPolicy : lecture selon publication, propriété et rôle', function () {
    $published = makeProvider(['user_id' => $this->owner->id]);
    $draft = Provider::factory()->pending()->create(['user_id' => $this->owner->id, 'city_id' => $published->city_id]);

    expect(Gate::forUser(null)->allows('view', $published))->toBeTrue();
    expect(Gate::forUser(null)->allows('view', $draft))->toBeFalse();
    expect(Gate::forUser($this->member)->allows('view', $draft))->toBeFalse();
    expect(Gate::forUser($this->stranger)->allows('view', $draft))->toBeFalse();
    expect(Gate::forUser($this->editor)->allows('view', $draft))->toBeFalse();
    expect(Gate::forUser($this->owner)->allows('view', $draft))->toBeTrue();
    expect(Gate::forUser($this->admin)->allows('view', $draft))->toBeTrue();
});

it('ProviderPolicy : modification, champs sensibles, approbation, suppression', function () {
    $p = makeProvider(['user_id' => $this->owner->id]);

    expect(Gate::forUser($this->owner)->allows('update', $p))->toBeTrue();
    expect(Gate::forUser($this->stranger)->allows('update', $p))->toBeFalse();
    expect(Gate::forUser($this->member)->allows('update', $p))->toBeFalse();
    expect(Gate::forUser($this->editor)->allows('update', $p))->toBeFalse();
    expect(Gate::forUser($this->admin)->allows('update', $p))->toBeTrue();

    expect(Gate::forUser($this->owner)->allows('updateSensitive', $p))->toBeFalse();
    expect(Gate::forUser($this->admin)->allows('updateSensitive', $p))->toBeTrue();
    expect(Gate::forUser($this->owner)->allows('requestChange', $p))->toBeTrue();
    expect(Gate::forUser($this->stranger)->allows('requestChange', $p))->toBeFalse();

    foreach (['approve', 'delete'] as $ability) {
        expect(Gate::forUser($this->owner)->allows($ability, $p))->toBeFalse();
        expect(Gate::forUser($this->editor)->allows($ability, $p))->toBeFalse();
        expect(Gate::forUser($this->admin)->allows($ability, $p))->toBeTrue();
    }

    expect(Gate::forUser($this->owner)->allows('create', Provider::class))->toBeTrue();
    expect(Gate::forUser($this->member)->allows('create', Provider::class))->toBeFalse();
    expect(Gate::forUser($this->editor)->allows('create', Provider::class))->toBeFalse();
});

it('ReviewPolicy : lecture, création (un avis par prestataire, e-mail vérifié), édition, modération, réponse', function () {
    $provider = makeProvider(['user_id' => $this->owner->id]);
    $author = User::factory()->create();
    $pending = Review::factory()->pending()->create(['provider_id' => $provider->id, 'user_id' => $author->id]);
    $published = Review::factory()->create(['provider_id' => $provider->id]);

    // Lecture
    expect(Gate::forUser(null)->allows('view', $published))->toBeTrue();
    expect(Gate::forUser(null)->allows('view', $pending))->toBeFalse();
    expect(Gate::forUser($this->member)->allows('view', $pending))->toBeFalse();
    expect(Gate::forUser($author)->allows('view', $pending))->toBeTrue();
    expect(Gate::forUser($this->admin)->allows('view', $pending))->toBeTrue();

    // Création
    expect(Gate::forUser($this->member)->allows('create', [Review::class, $provider]))->toBeTrue();
    expect(Gate::forUser($author)->allows('create', [Review::class, $provider]))->toBeFalse(); // déjà un avis
    expect(Gate::forUser(User::factory()->unverified()->create())->allows('create', [Review::class, $provider]))->toBeFalse();
    $hidden = Provider::factory()->pending()->create(['city_id' => $provider->city_id]);
    expect(Gate::forUser($this->member)->allows('create', [Review::class, $hidden]))->toBeFalse();

    // Modification : auteur tant que pending
    expect(Gate::forUser($author)->allows('update', $pending))->toBeTrue();
    expect(Gate::forUser($author)->allows('update', $published))->toBeFalse();
    expect(Gate::forUser($this->member)->allows('update', $pending))->toBeFalse();
    expect(Gate::forUser($this->admin)->allows('update', $published))->toBeTrue();

    // Modération
    expect(Gate::forUser($this->admin)->allows('moderate', $pending))->toBeTrue();
    foreach ([$author, $this->owner, $this->editor] as $u) {
        expect(Gate::forUser($u)->allows('moderate', $pending))->toBeFalse();
    }

    // Réponse unique du propriétaire de la fiche
    expect(Gate::forUser($this->owner)->allows('reply', $published))->toBeTrue();
    expect(Gate::forUser($this->stranger)->allows('reply', $published))->toBeFalse();
    expect(Gate::forUser($this->owner)->allows('reply', $pending))->toBeFalse();
    $published->forceFill(['provider_reply' => 'Merci', 'provider_replied_at' => now()])->save();
    expect(Gate::forUser($this->owner)->allows('reply', $published->fresh()))->toBeFalse();

    // Signalement : pas son propre avis
    expect(Gate::forUser($this->member)->allows('report', $published))->toBeTrue();
    expect(Gate::forUser($published->user, 'report')->allows('report', $published))->toBeFalse();
});

it('UserPolicy est enregistrée', function () {
    expect(Gate::getPolicyFor(User::class))->not->toBeNull();
});

it('les champs sensibles ne sont pas assignables en masse', function () {
    // Hors production, l'assignation d'un champ non fillable lève une exception (preventSilentlyDiscardingAttributes) ;
    // en production il est ignoré. Dans les deux cas, il n'est jamais écrit.
    $forbidden = [
        Provider::class => ['status', 'is_visible', 'is_verified', 'is_featured', 'user_id', 'rccm', 'approval_number', 'reviewed_by', 'views_count', 'rating_avg'],
        Review::class => ['status', 'is_visible', 'user_id', 'provider_id', 'moderated_by', 'provider_reply'],
        User::class => ['role', 'is_active', 'email_verified_at', 'two_factor_secret'],
        StateForce::class => ['status', 'is_visible', 'user_id', 'reviewed_by'],
    ];

    foreach ($forbidden as $class => $fields) {
        foreach ($fields as $field) {
            expect(fn () => (new $class)->fill([$field => 'x']))->toThrow(MassAssignmentException::class);
            expect((new $class)->isFillable($field))->toBeFalse();
        }
    }
});
