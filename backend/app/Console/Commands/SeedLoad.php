<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Jeu de données volumineux (FACTICE) pour mesurer les performances. Jamais appelé par DemoSeeder.
 * Refuse de tourner en production et sur toute base dont le nom ne contient pas « perf » (sauf --force) :
 * à utiliser sur une base dédiée (ex. protectici_perf). Insertions SQL ensemblistes.
 */
class SeedLoad extends Command
{
    protected $signature = 'app:seed-load
        {--providers=5000 : nombre de prestataires}
        {--state-forces=800 : nombre de forces étatiques}
        {--posts=3000 : nombre d\'articles}
        {--reviews=20000 : nombre d\'avis}
        {--force : autorise une base dont le nom ne contient pas "perf"}';

    protected $description = 'Génère un volume réaliste de données factices pour les mesures de performance (refuse la production)';

    public function handle(): int
    {
        if (app()->isProduction()) {
            $this->error('app:seed-load est interdit en production.');

            return self::FAILURE;
        }

        $database = (string) DB::connection()->getDatabaseName();
        if (! str_contains($database, 'perf') && ! $this->option('force')) {
            $this->error("Base « {$database} » refusée : utiliser une base dédiée dont le nom contient « perf ».");

            return self::FAILURE;
        }

        $providers = max(1, (int) $this->option('providers'));
        $forces = max(1, (int) $this->option('state-forces'));
        $posts = max(1, (int) $this->option('posts'));
        $reviews = max(0, (int) $this->option('reviews'));

        DB::transaction(function () use ($providers, $forces, $posts, $reviews): void {
            DB::statement('SELECT setseed(0.42)');

            $this->providers($providers);
            $this->stateForces($forces);
            $this->reviews($reviews, $providers);
            $this->posts($posts);
        });

        DB::statement('ANALYZE');
        $this->info("Charge générée : {$providers} prestataires, {$forces} forces, {$reviews} avis, {$posts} articles.");

        return self::SUCCESS;
    }

    private function providers(int $n): void
    {
        DB::statement("
            INSERT INTO providers (name, slug, description, price_from, phone, email, address, city_id,
                latitude, longitude, is_in_service, status, is_visible, is_verified, is_featured, views_count, created_at, updated_at)
            SELECT 'Charge Sécurité '||g||' '||(ARRAY['Garde','Alarme','Vidéosurveillance','Gardiennage','Escorte','Incendie','Cynophile'])[1 + g % 7],
                'charge-'||g, 'Société de sécurité privée numéro '||g||' : gardiennage, surveillance et intervention à Abidjan.',
                CASE WHEN g % 3 = 0 THEN 75000 ELSE NULL END, '+225 07 '||lpad((g % 100000)::text, 8, '0'),
                'charge'||g||'@example.test', g||' rue des Tests',
                c.id,
                5.20 + random() * 0.30, -4.15 + random() * 0.30, true,
                CASE WHEN g % 20 = 0 THEN 'pending' ELSE 'approved' END, g % 20 <> 0, g % 5 = 0, g % 50 = 0,
                (random() * 5000)::int, now() - (g || ' minutes')::interval, now()
            FROM generate_series(1, ?) g
            JOIN LATERAL (SELECT id FROM cities ORDER BY id OFFSET (g % 12) LIMIT 1) c ON true
        ", [$n]);

        DB::statement("UPDATE providers SET district_id = (SELECT id FROM districts d WHERE d.city_id = providers.city_id ORDER BY id OFFSET (providers.id % 3) LIMIT 1) WHERE slug LIKE 'charge-%'");
        DB::statement("INSERT INTO provider_service_type (provider_id, service_type_id) SELECT p.id, s.id FROM providers p JOIN LATERAL (SELECT id FROM service_types ORDER BY id OFFSET ((p.id * 7 + p.id / 12) % 20) LIMIT 3) s ON true WHERE p.slug LIKE 'charge-%' ON CONFLICT DO NOTHING");
        DB::statement("INSERT INTO provider_company_type (provider_id, company_type_id) SELECT p.id, s.id FROM providers p JOIN LATERAL (SELECT id FROM company_types ORDER BY id OFFSET (p.id % 3) LIMIT 1) s ON true WHERE p.slug LIKE 'charge-%' ON CONFLICT DO NOTHING");
        DB::statement("INSERT INTO provider_executives (provider_id, full_name, position, sort_order, created_at, updated_at) SELECT p.id, 'Dirigeant '||p.id||'-'||k, (ARRAY['general_manager','commercial_manager','operations_manager'])[1 + k % 3], k, now(), now() FROM providers p CROSS JOIN generate_series(1, 2) k WHERE p.slug LIKE 'charge-%'");
        DB::statement("INSERT INTO media (mediable_type, mediable_id, collection, disk, path, original_name, mime_type, size_bytes, sort_order) SELECT 'provider', p.id, 'logo', 'public', 'perf/logo-'||p.id||'.png', 'logo.png', 'image/png', 1000, 0 FROM providers p WHERE p.slug LIKE 'charge-%' AND p.id % 2 = 0");
        DB::statement("INSERT INTO media (mediable_type, mediable_id, collection, disk, path, original_name, mime_type, size_bytes, sort_order) SELECT 'provider', p.id, 'gallery', 'public', 'perf/g-'||p.id||'-'||k||'.jpg', 'g.jpg', 'image/jpeg', 1000, k FROM providers p CROSS JOIN generate_series(1, 4) k WHERE p.slug LIKE 'charge-%' AND p.id % 4 = 0");
    }

    private function stateForces(int $n): void
    {
        DB::statement("
            INSERT INTO state_forces (force_type_id, city_id, name, slug, description, phone, address, latitude, longitude,
                is_open_24h, status, is_visible, views_count, created_at, updated_at)
            SELECT t.id, c.id, 'Commissariat de charge '||g, 'force-charge-'||g, 'Structure factice de charge '||g, '+225 27 '||lpad(g::text, 8, '0'), g||' avenue des Tests',
                5.20 + random() * 0.30, -4.15 + random() * 0.30, true, 'approved', g % 25 <> 0, (random() * 500)::int, now(), now()
            FROM generate_series(1, ?) g
            JOIN LATERAL (SELECT id FROM state_force_types ORDER BY id OFFSET (g % 3) LIMIT 1) t ON true
            JOIN LATERAL (SELECT id FROM cities ORDER BY id OFFSET (g % 12) LIMIT 1) c ON true
        ", [$n]);
        DB::statement("INSERT INTO state_force_procedure_type (state_force_id, procedure_type_id) SELECT f.id, s.id FROM state_forces f JOIN LATERAL (SELECT id FROM procedure_types ORDER BY id OFFSET (f.id % 4) LIMIT 2) s ON true WHERE f.slug LIKE 'force-charge-%' ON CONFLICT DO NOTHING");
    }

    private function reviews(int $n, int $providers): void
    {
        if ($n === 0) {
            return;
        }
        DB::statement("
            INSERT INTO users (first_name, last_name, email, password, email_verified_at, role, is_active, created_at, updated_at)
            SELECT 'Charge', 'Utilisateur '||g, 'charge-user-'||g||'@example.test', '!', now(), 'user', true, now(), now()
            FROM generate_series(1, 1000) g ON CONFLICT DO NOTHING
        ");
        DB::statement("
            INSERT INTO reviews (provider_id, user_id, rating, title, body, status, is_visible, moderated_at, created_at, updated_at)
            SELECT p.id, u.id, 1 + (p.id + u.id) % 5, 'Avis '||g, 'Avis de charge numéro '||g, 'approved', true, now(), now() - (g || ' minutes')::interval, now()
            FROM generate_series(1, ?) g
            JOIN LATERAL (SELECT id FROM providers WHERE slug LIKE 'charge-%' AND status = 'approved' ORDER BY id OFFSET (g * 7 % ?) LIMIT 1) p ON true
            JOIN LATERAL (SELECT id FROM users WHERE email LIKE 'charge-user-%' ORDER BY id OFFSET (g % 1000) LIMIT 1) u ON true
            ON CONFLICT DO NOTHING
        ", [$n, max(1, $providers - 1)]);
    }

    private function posts(int $n): void
    {
        DB::statement('UPDATE post_categories SET is_visible = true');
        DB::statement("
            INSERT INTO posts (category_id, title, slug, excerpt, body, status, published_at, is_featured, is_flash, views_count, reading_minutes, is_visible, created_at, updated_at)
            SELECT c.id, 'Article de charge '||g||' sur la sécurité des entreprises', 'article-charge-'||g, 'Résumé de l''article de charge '||g,
                '<p>Contenu factice sur la vidéosurveillance, le gardiennage et la prévention incendie, numéro '||g||'.</p>',
                'published', now() - (g || ' hours')::interval, g % 40 = 0, g % 100 = 0, (random() * 20000)::int, 3, true, now(), now()
            FROM generate_series(1, ?) g
            JOIN LATERAL (SELECT id FROM post_categories ORDER BY id OFFSET (g % 7) LIMIT 1) c ON true
        ", [$n]);
    }
}
