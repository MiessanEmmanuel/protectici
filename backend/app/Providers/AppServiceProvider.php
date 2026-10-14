<?php

namespace App\Providers;

use App\Models\ContactMessage;
use App\Models\Feedback;
use App\Models\Media;
use App\Models\NewsletterSubscriber;
use App\Models\Page;
use App\Models\Partner;
use App\Models\Post;
use App\Models\PostCategory;
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
use Illuminate\Support\Facades\URL;
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
        self::pinRootUrl();

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
            'post_category' => PostCategory::class,
            'newsletter_subscriber' => NewsletterSubscriber::class,
        ]);

        // Détection des oublis hors production (security.md §13).
        $strict = ! $this->app->isProduction();
        Model::preventLazyLoading($strict);
        Model::preventSilentlyDiscardingAttributes($strict);
        Model::preventAccessingMissingAttributes($strict);

        // Zone d'administration : rôle admin actif uniquement (l'éditeur n'y a aucun accès, security.md §12).
        Gate::define('admin-area', fn (User $user): bool => $user->isAdmin() && $user->is_active);
        // Back-office éditorial : rôle editor OU admin, comptes actifs (security.md §12).
        Gate::define('content-area', fn (User $user): bool => $user->isStaff() && $user->is_active);
        // Inscription d'un établissement : compte actif et e-mail vérifié.
        Gate::define('register-establishment', fn (User $user): bool => $user->is_active && $user->hasVerifiedEmail());

        // Administration : 120 / minute / administrateur.
        RateLimiter::for('admin-api', fn (Request $r) => Limit::perMinute(120)->by('admin|'.($r->user()?->getAuthIdentifier() ?? $r->ip())));

        RateLimiter::for('content-api', fn (Request $r) => Limit::perMinute(120)->by('content|'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        RateLimiter::for('content-upload', fn (Request $r) => Limit::perHour(60)->by('content-upload|'.($r->user()?->getAuthIdentifier() ?? $r->ip())));

        // Phase 4 (security.md §18) : lecture publique 60/min/IP ; commentaires 5/h/utilisateur ;
        // liens de newsletter (confirmation / désinscription) 20/h/IP.
        RateLimiter::for('public-read', fn (Request $r) => self::publicReadLimit($r, 'public-read'));
        RateLimiter::for('blog-comment', fn (Request $r) => Limit::perHour((int) config('public_forms.comments_per_hour_per_user'))->by('blog-comment:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        RateLimiter::for('newsletter-link', fn (Request $r) => Limit::perHour((int) config('public_forms.newsletter_link_per_hour_per_ip'))->by('newsletter-link:'.$r->ip()));

        // Limiteurs de l'annuaire public (security.md §18) : clé = IP.
        RateLimiter::for('public-search', fn (Request $r) => self::publicReadLimit($r, 'public-search'));
        RateLimiter::for('geocode', fn (Request $r) => Limit::perMinute(30)->by('geocode:'.$r->ip()));
        // Phase 3 vague B (security.md §18) : avis 10 / jour / utilisateur, signalements 20 / jour / utilisateur,
        // suivi de dossier 10 / heure / IP et 5 / heure / référence (chaque tentative compte : anti-énumération).
        RateLimiter::for('review-create', fn (Request $r) => Limit::perDay((int) config('public_forms.reviews_per_day_per_user'))->by('review-create:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        RateLimiter::for('review-report', fn (Request $r) => Limit::perDay(20)->by('review-report:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        RateLimiter::for('feedback-track', function (Request $r) {
            $reference = is_string($r->input('reference')) ? mb_strtoupper(trim($r->input('reference'))) : '';

            return [
                Limit::perHour((int) config('public_forms.track_per_hour_per_ip'))->by('feedback-track-ip:'.$r->ip()),
                Limit::perHour((int) config('public_forms.track_per_hour_per_reference'))->by('feedback-track-ref:'.sha1($reference)),
            ];
        });
        RateLimiter::for('provider-view', fn (Request $r) => Limit::perMinute(30)->by('provider-view:'.$r->ip()));
    }

    /**
     * Lecture publique : 60 / minute / IP pour les navigateurs. Les rendus serveur de Next.js arrivent tous de l'IP
     * du conteneur `web` : sans distinction, tout le site partagerait ce plafond (auto-déni de service). Une requête
     * qui présente le secret partagé SSR_SHARED_SECRET (comparaison en temps constant, jamais exposé au navigateur)
     * dispose d'un seau distinct et plus large. Secret vide = mécanisme désactivé.
     */
    private static function publicReadLimit(Request $request, string $name): Limit
    {
        $secret = (string) config('services.ssr.secret');
        $given = (string) $request->header('X-SSR-Secret', '');

        if ($secret !== '' && $given !== '' && hash_equals($secret, $given)) {
            return Limit::perMinute((int) config('services.ssr.per_minute', 1200))->by($name.':ssr');
        }

        return Limit::perMinute(60)->by($name.':'.$request->ip());
    }

    /**
     * Anti « Host header injection » : en production/staging, les URL générées par l'API (liens signés de
     * vérification d'e-mail, notamment) partent toujours de APP_URL et jamais de l'en-tête Host de la requête.
     */
    public static function pinRootUrl(): void
    {
        if (app()->environment(['production', 'staging']) && (string) config('app.url') !== '') {
            URL::forceRootUrl((string) config('app.url'));
            URL::forceScheme(parse_url((string) config('app.url'), PHP_URL_SCHEME) ?: 'https');
        }
    }
}
