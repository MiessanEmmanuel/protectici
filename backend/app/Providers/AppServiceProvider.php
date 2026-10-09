<?php

namespace App\Providers;

use App\Models\ContactMessage;
use App\Models\Feedback;
use App\Models\Media;
use App\Models\Page;
use App\Models\Partner;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\Provider;
use App\Models\ProviderChangeRequest;
use App\Models\ProviderDocument;
use App\Models\QuoteRequest;
use App\Models\Review;
use App\Models\Setting;
use App\Models\StateForce;
use App\Models\User;
use App\Services\Geocoding\Geocoder;
use App\Services\Geocoding\NominatimGeocoder;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(Geocoder::class, fn () => new NominatimGeocoder(
            (string) config('services.nominatim.url'),
            (string) config('services.nominatim.user_agent'),
            (int) config('services.nominatim.cache_ttl'),
        ));
    }

    public function boot(): void
    {
        // Morph map obligatoire (modele.md §1.4, §8) : jamais de nom de classe en base.
        Relation::enforceMorphMap([
            'user' => User::class,
            'provider' => Provider::class,
            'state_force' => StateForce::class,
            'review' => Review::class,
            'post' => Post::class,
            'post_comment' => PostComment::class,
            'partner' => Partner::class,
            'page' => Page::class,
            'feedback' => Feedback::class,
            'quote_request' => QuoteRequest::class,
            'contact_message' => ContactMessage::class,
            'provider_change_request' => ProviderChangeRequest::class,
            'provider_document' => ProviderDocument::class,
            'media' => Media::class,
            'setting' => Setting::class,
        ]);

        // Détection des oublis hors production (security.md §13).
        $strict = ! $this->app->isProduction();
        Model::preventLazyLoading($strict);
        Model::preventSilentlyDiscardingAttributes($strict);
        Model::preventAccessingMissingAttributes($strict);

        // Zone d'administration : rôle admin actif uniquement (l'éditeur n'y a aucun accès, security.md §12).
        Gate::define('admin-area', fn (User $user): bool => $user->isAdmin() && $user->is_active);
        // Inscription d'un établissement : compte actif et e-mail vérifié.
        Gate::define('register-establishment', fn (User $user): bool => $user->is_active && $user->hasVerifiedEmail());

        // Administration : 120 / minute / administrateur.
        RateLimiter::for('admin-api', fn (Request $r) => Limit::perMinute(120)->by('admin|'.($r->user()?->getAuthIdentifier() ?? $r->ip())));

        // Limiteurs de l'annuaire public (security.md §18) : clé = IP.
        RateLimiter::for('public-search', fn (Request $r) => Limit::perMinute(60)->by('public-search:'.$r->ip()));
        RateLimiter::for('geocode', fn (Request $r) => Limit::perMinute(30)->by('geocode:'.$r->ip()));
        RateLimiter::for('provider-view', fn (Request $r) => Limit::perMinute(30)->by('provider-view:'.$r->ip()));
    }
}
