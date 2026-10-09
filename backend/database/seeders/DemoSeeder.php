<?php

namespace Database\Seeders;

use App\Models\City;
use App\Models\CompanyType;
use App\Models\District;
use App\Models\Partner;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\ProcedureType;
use App\Models\Provider;
use App\Models\ProviderChangeRequest;
use App\Models\ProviderDocument;
use App\Models\ProviderExecutive;
use App\Models\Review;
use App\Models\ServiceType;
use App\Models\StateForce;
use App\Models\StateForceType;
use App\Models\User;
use Database\Factories\UserFactory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Données FACTICES de démonstration (local / staging). Refuse de s'exécuter en production.
 * Aucune donnée réelle : RCCM, agréments, téléphones, e-mails et coordonnées sont inventés.
 */
class DemoSeeder extends Seeder
{
    /** @var Collection<int, District> */
    private Collection $districts;

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('DemoSeeder est interdit en production (données factices et comptes de test).');
        }

        if (! City::where('slug', 'abidjan')->exists()) {
            $this->call(ReferenceSeeder::class);
        }

        fake()->seed(20261007);
        $this->districts = District::where('is_visible', true)->get();

        DB::transaction(function () {
            $accounts = $this->users();
            $providers = $this->providers($accounts['provider']);
            $this->reviews($providers, $accounts['reviewers']);
            $this->establishmentWorkflow($accounts['provider'], $accounts['user'], $providers->first());
            $this->stateForces();
            $this->posts($accounts['editor']);
            $this->partners();
        });
    }

    /** @return array{admin: User, editor: User, provider: User, user: User, reviewers: Collection<int, User>} */
    private function users(): array
    {
        $password = Hash::make(UserFactory::TEST_PASSWORD);

        $make = function (string $email, string $first, string $last, string $role) use ($password): User {
            $user = User::withTrashed()->firstOrNew(['email' => $email]);
            $user->forceFill([
                'first_name' => $first, 'last_name' => $last, 'role' => $role,
                'password' => $password, 'email_verified_at' => now(), 'is_active' => true,
                'phone' => '+22507000000'.str_pad((string) random_int(0, 99), 2, '0', STR_PAD_LEFT),
            ])->save();

            return $user;
        };

        $admin = $make('admin@demo.protectici.test', 'Awa', 'Administratrice', User::ROLE_ADMIN);
        $editor = $make('editeur@demo.protectici.test', 'Koffi', 'Éditeur', User::ROLE_EDITOR);
        $provider = $make('prestataire@demo.protectici.test', 'Yao', 'Prestataire', User::ROLE_PROVIDER);
        $user = $make('utilisateur@demo.protectici.test', 'Aminata', 'Utilisatrice', User::ROLE_USER);

        $reviewers = collect(range(1, 30))->map(fn (int $i) => $make(
            sprintf('avis%02d@demo.protectici.test', $i),
            fake()->firstName(),
            fake()->lastName(),
            User::ROLE_USER,
        ));

        return compact('admin', 'editor', 'provider', 'user', 'reviewers');
    }

    /** @return Collection<int, Provider> */
    private function providers(User $owner): Collection
    {
        $services = ServiceType::pluck('id', 'slug');
        $companyTypes = CompanyType::pluck('id', 'slug');
        $abidjan = City::where('slug', 'abidjan')->firstOrFail();

        $named = [
            ['Dauphin Sécurité', 'deux-plateaux', 'sarl', ['gardiennage-arme', 'gardiennage-non-arme', 'videosurveillance', 'alarme-controle-d-acces-et-anti-intrusion'], 'entreprise-de-securite-et-surete-agreee', true, true],
            ['Fenapepsci', 'plateau', 'association', ['formation', 'veille-securitaire', 'audit-de-securite'], 'association-et-club', true, false],
            ['Global Security Challenge', 'plateau', 'sa', ['audit-de-securite', 'securite-informatique', 'investigation-et-detective-prive', 'garde-rapprochee'], 'entreprise-de-securite-et-surete-agreee', true, true],
            ['Puissance 6 Security', 'zone-4', 'sarl', ['brigade-canine', 'brigade-canine-de-detection', 'gardiennage-arme', 'escorte'], 'entreprise-de-securite-et-surete-agreee', false, true],
            ['Royal Force', 'niangon', 'suarl', ['gardiennage-non-arme', 'securite-evenementielle', 'hotesse-et-steward-de-securite'], 'entreprise-de-securite-et-surete-agreee', false, false],
        ];

        $providers = collect();
        $serial = 11;

        foreach ($named as $i => [$name, $districtSlug, $form, $serviceSlugs, $companyType, $verified, $featured]) {
            $district = $this->districts->firstWhere('slug', $districtSlug);
            $provider = $this->saveProvider([
                'name' => $name,
                'description' => $this->description($name, $serviceSlugs),
                'district' => $district,
                'city_id' => $abidjan->id,
                'legal_form' => $form,
                'serial' => $serial++,
                'is_verified' => $verified,
                'is_featured' => $featured,
                'status' => 'approved',
                'user_id' => $i === 0 ? $owner->id : null,
            ]);
            $this->attach($provider, $serviceSlugs, [$companyType], $services, $companyTypes);
            $providers->push($provider);
        }

        // 35 fiches générées (dont quelques fiches non publiées pour tester l'exposition).
        $prefixes = ['Alpha', 'Atlas', 'Bouclier', 'Sentinelle', 'Vigie', 'Cerbère', 'Phénix', 'Horizon', 'Lion', 'Baobab', 'Eburnéa', 'Lagune', 'Ivoire', 'Savane', 'Kapok', 'Griffon', 'Rempart', 'Citadelle', 'Aigle', 'Zénith', 'Bélier', 'Étoile', 'Palmier', 'Comoé', 'Bandama', 'Sassandra', 'Tanoé', 'Cavally', 'Nzi', 'Éburnie', 'Akwaba', 'Gardian', 'Vigilis', 'Securis', 'Protectis'];
        $suffixes = ['Sécurité', 'Protection', 'Gardiennage', 'Sûreté', 'Security', 'Guard Services'];
        $slugs = $services->keys()->values();
        $companySlugs = $companyTypes->keys()->values();
        $otherCities = City::whereIn('slug', ['bouake', 'yamoussoukro', 'san-pedro'])->get();

        for ($n = 0; $n < 35; $n++) {
            $name = $prefixes[$n].' '.$suffixes[$n % count($suffixes)];
            $serviceSlugs = collect($slugs)->random(fake()->numberBetween(2, 5))->all();
            $inAbidjan = $n < 29;
            $status = match (true) {
                $n === 29 => 'pending',
                $n === 30 => 'rejected',
                $n === 31 => 'suspended',
                default => 'approved',
            };

            $provider = $this->saveProvider([
                'name' => $name,
                'description' => $this->description($name, $serviceSlugs),
                'district' => $inAbidjan ? $this->districts->random() : null,
                'city_id' => $inAbidjan ? $abidjan->id : $otherCities->random()->id,
                'legal_form' => fake()->randomElement(['sarl', 'sa', 'sas', 'suarl', 'ei']),
                'serial' => $serial++,
                'is_verified' => fake()->boolean(35),
                'is_featured' => fake()->boolean(15),
                'status' => $status,
                'user_id' => null,
            ]);
            $this->attach($provider, $serviceSlugs, [$companySlugs->random()], $services, $companyTypes);
            $providers->push($provider);
        }

        // Une fiche supprimée logiquement : ne doit jamais apparaître publiquement.
        $deleted = $this->saveProvider([
            'name' => 'Ancienne Fiche Supprimée',
            'description' => 'Fiche factice supprimée (test de non-exposition).',
            'district' => null,
            'city_id' => $abidjan->id,
            'legal_form' => 'sarl',
            'serial' => $serial++,
            'is_verified' => false,
            'is_featured' => false,
            'status' => 'approved',
            'user_id' => null,
        ]);
        $deleted->delete();

        return $providers;
    }

    /** @param array<string, mixed> $d */
    /**
     * Données du workflow d'établissements (vague A) : fiches en attente du compte prestataire de démo,
     * demande de modification en attente, justificatif factice sur le disque privé, force étatique en attente.
     */
    private function establishmentWorkflow(User $provider, User $user, Provider $approved): void
    {
        $abidjan = City::where('slug', 'abidjan')->firstOrFail();
        $services = ServiceType::pluck('id', 'slug');
        $companyTypes = CompanyType::pluck('id', 'slug');

        $pending = [];
        foreach ([['Sentinelle Démo Sécurité', 101, ['gardiennage-non-arme', 'videosurveillance']], ['Rempart Démo Protection', 102, ['brigade-canine', 'escorte']]] as [$name, $serial, $slugs]) {
            $p = $this->saveProvider([
                'name' => $name, 'description' => $this->description($name, $slugs), 'district' => null,
                'city_id' => $abidjan->id, 'legal_form' => 'sarl', 'serial' => $serial,
                'is_verified' => false, 'is_featured' => false, 'status' => 'pending', 'user_id' => $provider->id,
            ]);
            $this->attach($p, $slugs, ['entreprise-de-securite-et-surete-agreee'], $services, $companyTypes);
            $pending[] = $p;
        }

        if (! ProviderChangeRequest::where('provider_id', $approved->id)->where('status', 'pending')->exists()) {
            $request = new ProviderChangeRequest;
            $request->forceFill([
                'provider_id' => $approved->id,
                'requested_by' => $provider->id,
                'changes' => [
                    'corporate_purpose' => ['old' => $approved->corporate_purpose, 'new' => 'Gardiennage, télésurveillance et conseil en sûreté (objet social fictif mis à jour).'],
                    'share_capital' => ['old' => $approved->share_capital, 'new' => 20_000_000],
                ],
            ])->save();
        }

        $pendingProvider = $pending[0];
        if (! ProviderDocument::where('provider_id', $pendingProvider->id)->exists()) {
            $disk = (string) config('establishments.documents_disk');
            $path = 'documents/provider/'.$pendingProvider->id.'/demo-justificatif-factice.pdf';
            Storage::disk($disk)->put($path, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%% Justificatif FACTICE de démonstration\n%%EOF", 'private');
            (new ProviderDocument)->fill([
                'provider_id' => $pendingProvider->id, 'type' => 'approval_certificate', 'disk' => $disk, 'path' => $path,
                'original_name' => 'agrement-factice.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => (int) Storage::disk($disk)->size($path),
            ])->save();
        }

        $forceType = StateForceType::query()->orderBy('id')->firstOrFail();
        $force = StateForce::withTrashed()->firstOrNew(['slug' => 'commissariat-demo-en-attente']);
        $force->forceFill([
            'user_id' => $user->id, 'force_type_id' => $forceType->id, 'name' => 'Commissariat Démo en attente',
            'description' => 'Fiche factice en attente de validation.', 'phone' => '+22527200099',
            'city_id' => $abidjan->id, 'status' => 'pending', 'is_visible' => false,
        ])->save();
    }

    /** @param array<string, mixed> $d */
    private function saveProvider(array $d): Provider
    {
        /** @var District|null $district */
        $district = $d['district'];
        $slug = Str::slug($d['name']);
        $domain = $slug.'.demo.test';
        $serial = str_pad((string) $d['serial'], 4, '0', STR_PAD_LEFT);
        $city = City::find($d['city_id']);
        $lat = (float) (($district ? $district->latitude : null) ?? $city->latitude) + fake()->randomFloat(5, -0.004, 0.004);
        $lng = (float) (($district ? $district->longitude : null) ?? $city->longitude) + fake()->randomFloat(5, -0.004, 0.004);
        $published = $d['status'] === 'approved';

        $provider = Provider::withTrashed()->firstOrNew(['slug' => $slug]);
        $provider->forceFill([
            'user_id' => $d['user_id'],
            'name' => $d['name'],
            'description' => $d['description'],
            'price_from' => fake()->randomElement([null, 50000, 75000, 100000, 150000, 250000]),
            'phone' => '+225 07 00 00 '.substr($serial, 0, 2).' '.substr($serial, 2, 2),
            'emergency_phone' => '+225 05 00 00 '.substr($serial, 0, 2).' '.substr($serial, 2, 2),
            'email' => 'contact@'.$domain,
            'website_url' => 'https://www.'.$domain,
            'facebook_url' => 'https://www.facebook.com/'.$slug.'.demo',
            'instagram_url' => fake()->boolean(60) ? 'https://www.instagram.com/'.$slug.'.demo' : null,
            'linkedin_url' => fake()->boolean(40) ? 'https://www.linkedin.com/company/'.$slug.'-demo' : null,
            'whatsapp_number' => '+225070000'.substr($serial, 0, 2).substr($serial, 2, 2),
            'address' => fake()->numberBetween(1, 120).' rue '.fake()->lastName().' (adresse fictive)',
            'city_id' => $d['city_id'],
            'district_id' => $district?->id,
            'geo_description' => $district ? 'Situé dans la commune de '.($district->parent_id ? $this->districts->firstWhere('id', $district->parent_id)?->name : $district->name).', à proximité d\'un axe principal (description fictive).' : 'Description géographique fictive.',
            'plus_code' => strtoupper(fake()->bothify('####+??')),
            'latitude' => round($lat, 6),
            'longitude' => round($lng, 6),
            'rccm' => 'CI-ABJ-DEMO-'.$serial,
            'legal_form' => $d['legal_form'],
            'share_capital' => fake()->randomElement([1_000_000, 5_000_000, 10_000_000, 50_000_000]),
            'corporate_purpose' => 'Prestations de sécurité privée et de sûreté (objet social fictif).',
            'approval_number' => 'AGR-DEMO-'.$serial,
            'approval_expires_at' => now()->addMonths(fake()->numberBetween(3, 30))->toDateString(),
            'submitter_role' => fake()->randomElement(['manager', 'employee', 'other']),
            'is_in_service' => true,
            'status' => $d['status'],
            'rejection_reason' => $d['status'] === 'rejected' ? 'Justificatifs illisibles (donnée factice).' : null,
            'reviewed_at' => $d['status'] === 'pending' ? null : now(),
            'is_verified' => $published && $d['is_verified'],
            'verified_at' => $published && $d['is_verified'] ? now() : null,
            'is_featured' => $published && $d['is_featured'],
            'views_count' => $published ? fake()->numberBetween(0, 1500) : 0,
            'is_visible' => $published,
        ])->save();

        // Dirigeants (affichage public uniquement si is_visible).
        ProviderExecutive::where('provider_id', $provider->id)->delete();
        foreach (['general_manager', 'commercial_manager', 'operations_manager'] as $order => $position) {
            ProviderExecutive::factory()->create([
                'provider_id' => $provider->id,
                'full_name' => fake()->name(),
                'position' => $position,
                'sort_order' => $order,
                'is_visible' => $order === 0 || fake()->boolean(50),
            ]);
        }

        return $provider;
    }

    /**
     * @param  list<string>  $serviceSlugs
     * @param  list<string>  $companySlugs
     * @param  Collection<string, int>  $services
     * @param  Collection<string, int>  $companyTypes
     */
    private function attach(Provider $provider, array $serviceSlugs, array $companySlugs, Collection $services, Collection $companyTypes): void
    {
        $provider->serviceTypes()->sync(collect($serviceSlugs)->map(fn ($s) => $services[$s] ?? null)->filter()->all());
        $provider->companyTypes()->sync(collect($companySlugs)->map(fn ($s) => $companyTypes[$s] ?? null)->filter()->all());
    }

    /** @param list<string> $serviceSlugs */
    private function description(string $name, array $serviceSlugs): string
    {
        $labels = ServiceType::whereIn('slug', $serviceSlugs)->pluck('name')->map(fn ($n) => mb_strtolower($n))->implode(', ');

        return "{$name} est une société de démonstration (données fictives) qui propose : {$labels}. "
            .'Intervention rapide, agents formés et encadrement dédié sur le Grand Abidjan.';
    }

    /**
     * @param  Collection<int, Provider>  $providers
     * @param  Collection<int, User>  $reviewers
     */
    private function reviews(Collection $providers, Collection $reviewers): void
    {
        $bodies = [
            5 => ['Service irréprochable, des agents ponctuels et très professionnels. Je recommande sans hésiter.', 'Équipe réactive et à l\'écoute, installation de la vidéosurveillance faite en une journée.', 'Très satisfait de la prestation de gardiennage, tenue impeccable et courtoisie des agents.'],
            4 => ['Bonne prestation dans l\'ensemble, quelques retards à l\'ouverture mais un suivi sérieux.', 'Prix corrects et agents compétents. Le service client pourrait répondre plus vite.', 'Intervention rapide lors d\'une alarme, je reste globalement content.'],
            3 => ['Prestation correcte sans plus, la communication peut être améliorée.', 'Des agents sympathiques mais un manque de rigueur sur les horaires.'],
            2 => ['Peu de disponibilité de l\'encadrement et facturation confuse.', 'Le service ne correspond pas totalement à ce qui était promis au devis.'],
            1 => ['Très déçu : absence d\'agent un soir sans prévenir le client.', 'Aucune réponse à mes réclamations après la mise en place du contrat.'],
        ];
        $titles = ['Très bon service', 'Je recommande', 'Prestation correcte', 'Peut mieux faire', 'Sérieux et réactifs', null, null];
        $replies = ['Merci pour votre confiance, nous restons à votre disposition.', 'Nous avons pris note de votre retour et améliorons nos process.'];

        $public = $providers->where('status', 'approved')->values();

        foreach ($public as $provider) {
            $count = fake()->numberBetween(0, 8);
            foreach ($reviewers->random(min($count, $reviewers->count())) as $reviewer) {
                $rating = fake()->randomElement([5, 5, 5, 4, 4, 4, 3, 3, 2, 1]);
                $roll = fake()->numberBetween(1, 100);
                $state = $roll <= 85 ? 'approved' : ($roll <= 95 ? 'pending' : 'rejected');

                Review::factory()->create([
                    'provider_id' => $provider->id,
                    'user_id' => $reviewer->id,
                    'rating' => $rating,
                    'title' => fake()->randomElement($titles),
                    'body' => fake()->randomElement($bodies[$rating]),
                    'status' => $state,
                    'is_visible' => $state === 'approved',
                    'rejection_reason' => $state === 'rejected' ? 'Contenu non conforme (donnée factice).' : null,
                    'moderated_at' => $state === 'pending' ? null : now(),
                    ...($state === 'approved' && fake()->boolean(25)
                        ? ['provider_reply' => fake()->randomElement($replies), 'provider_replied_at' => now()]
                        : ['provider_reply' => null, 'provider_replied_at' => null]),
                ]);
            }
        }
    }

    private function stateForces(): void
    {
        $types = StateForceType::pluck('id', 'slug');
        $procedures = ProcedureType::pluck('id', 'slug');
        $police = $types['police-nationale-commissariat'];
        $gendarmerie = $types['gendarmerie-nationale'];
        $pompiers = $types['sapeurs-pompiers-militaires'];
        $abidjan = City::where('slug', 'abidjan')->firstOrFail();

        $communeOf = fn (string $slug) => $this->districts->firstWhere('slug', $slug);

        $entries = [];
        foreach (['plateau', 'adjame', 'treichville', 'marcory', 'koumassi', 'port-bouet', 'cocody', 'yopougon', 'abobo', 'attecoube'] as $i => $slug) {
            $entries[] = ['Commissariat de police de '.$communeOf($slug)->name, $police, $slug, '110', true];
            if ($i < 4) {
                $entries[] = ['Commissariat du '.($i + 2).'e arrondissement de '.$communeOf($slug)->name, $police, $slug, '110', true];
            }
        }
        foreach (['cocody', 'yopougon', 'abobo', 'bingerville', 'anyama', 'port-bouet', 'songon'] as $slug) {
            $entries[] = ['Brigade de gendarmerie de '.$communeOf($slug)->name, $gendarmerie, $slug, '143', true];
        }
        foreach (['plateau', 'cocody', 'yopougon', 'treichville', 'port-bouet', 'abobo'] as $slug) {
            $entries[] = ['Caserne des sapeurs-pompiers de '.$communeOf($slug)->name, $pompiers, $slug, '180', true];
        }
        $entries = array_slice($entries, 0, 28);

        $serial = 1;
        foreach ($entries as [$name, $typeId, $communeSlug, $emergency, $open24]) {
            $district = $communeOf($communeSlug);
            $this->saveStateForce($name, $typeId, $abidjan->id, $district, $emergency, $open24, $serial++, $typeId === $pompiers ? [] : $procedures->values()->all(), (int) $typeId === (int) $gendarmerie);
        }

        // Hors Abidjan + une fiche en attente et une masquée (tests d'exposition).
        $bouake = City::where('slug', 'bouake')->firstOrFail();
        $yakro = City::where('slug', 'yamoussoukro')->firstOrFail();
        $this->saveStateForce('Commissariat central de Bouaké', $police, $bouake->id, null, '110', true, $serial++, $procedures->values()->all(), false);
        $this->saveStateForce('Commissariat central de Yamoussoukro', $police, $yakro->id, null, '110', true, $serial++, $procedures->values()->all(), false);
        $this->saveStateForce('Commissariat en cours de validation', $police, $abidjan->id, $communeOf('cocody'), '110', false, $serial++, [], false, 'pending');
        $this->saveStateForce('Poste de police masqué', $police, $abidjan->id, $communeOf('abobo'), '110', false, $serial++, [], false, 'approved', false);
    }

    /** @param list<int> $procedureIds */
    private function saveStateForce(string $name, int $typeId, int $cityId, ?District $district, string $emergency, bool $open24, int $serial, array $procedureIds, bool $isGendarmerie, string $status = 'approved', bool $visible = true): void
    {
        $city = City::find($cityId);
        $lat = (float) (($district ? $district->latitude : null) ?? $city->latitude) + fake()->randomFloat(5, -0.006, 0.006);
        $lng = (float) (($district ? $district->longitude : null) ?? $city->longitude) + fake()->randomFloat(5, -0.006, 0.006);
        $slug = Str::slug($name);

        $force = StateForce::withTrashed()->firstOrNew(['slug' => $slug]);
        $force->forceFill([
            'force_type_id' => $typeId,
            'name' => $name,
            'description' => 'Structure de démonstration (données fictives) : accueil du public, dépôt de plaintes et orientation.',
            'phone' => '+225 27 20 00 '.str_pad((string) $serial, 2, '0', STR_PAD_LEFT).' '.str_pad((string) ($serial * 3 % 100), 2, '0', STR_PAD_LEFT),
            'emergency_phone' => $emergency,
            'email' => null,
            'address' => 'Adresse fictive, '.($district ? $district->name : $city->name),
            'city_id' => $cityId,
            'district_id' => $district?->id,
            'geo_description' => 'Description géographique fictive.',
            'plus_code' => strtoupper(fake()->bothify('####+??')),
            'latitude' => round($lat, 6),
            'longitude' => round($lng, 6),
            'opening_hours' => $open24 ? null : [
                'mon' => [['08:00', '17:00']], 'tue' => [['08:00', '17:00']], 'wed' => [['08:00', '17:00']],
                'thu' => [['08:00', '17:00']], 'fri' => [['08:00', '17:00']],
            ],
            'is_open_24h' => $open24,
            'status' => $status,
            'reviewed_at' => $status === 'pending' ? null : now(),
            'views_count' => fake()->numberBetween(0, 800),
            'is_visible' => $status === 'approved' && $visible,
        ])->save();

        $sync = [];
        foreach (collect($procedureIds)->random(min(count($procedureIds), $isGendarmerie ? 3 : 5)) as $id) {
            $sync[$id] = ['notes' => fake()->boolean(40) ? 'Se munir d\'une pièce d\'identité en cours de validité.' : null];
        }
        $force->procedureTypes()->sync($procedureIds === [] ? [] : $sync);
    }

    private function posts(User $editor): void
    {
        $categories = PostCategory::pluck('id', 'slug');
        $articles = [
            ['Comment choisir une société de gardiennage à Abidjan', 'actualites', 'Agrément, assurance, formation des agents : les points à vérifier avant de signer.', true, false],
            ['Vidéosurveillance à domicile : les erreurs à éviter', 'anti-intrusion', 'Emplacement des caméras, stockage des images, conformité : l\'essentiel pour bien s\'équiper.', false, false],
            ['Alarmes anti-intrusion : comprendre les différents capteurs', 'anti-intrusion', 'Détecteurs d\'ouverture, volumétriques, sirènes : comment composer un système fiable.', false, false],
            ['Cybercriminalité : protéger ses comptes en ligne', 'cybercriminalite', 'Mots de passe solides, double authentification et réflexes face à l\'hameçonnage.', false, true],
            ['Prévention incendie dans les commerces : les gestes essentiels', 'securite-incendie', 'Extincteurs, issues de secours, formation du personnel : les bases de la prévention.', false, false],
            ['Métiers de la sécurité privée : se former en Côte d\'Ivoire', 'formation', 'Panorama des formations, des certifications et des débouchés du secteur.', false, false],
        ];

        foreach ($articles as $i => [$title, $category, $excerpt, $featured, $flash]) {
            $post = Post::withTrashed()->firstOrNew(['slug' => Str::slug($title)]);
            $post->forceFill([
                'author_id' => $editor->id,
                'category_id' => $categories[$category],
                'title' => $title,
                'excerpt' => $excerpt,
                'body' => '<p>'.$excerpt.'</p><p>Article de démonstration (contenu fictif) : le texte définitif sera rédigé par l\'équipe éditoriale de ProtectIci.</p>',
                'status' => 'published',
                'published_at' => now()->subDays(10 - $i),
                'is_featured' => $featured,
                'is_flash' => $flash,
                'is_visible' => true,
                'views_count' => fake()->numberBetween(20, 900),
                'reading_minutes' => 3,
            ])->save();
        }
    }

    private function partners(): void
    {
        $rows = [
            ['partner', 'Association démo des acteurs de la sécurité'],
            ['partner', 'Centre de formation démo'],
            ['client', 'Groupe hôtelier démo'],
            ['client', 'Centre commercial démo'],
        ];
        foreach ($rows as $i => [$type, $name]) {
            $partner = Partner::withTrashed()->firstOrNew(['name' => $name]);
            $partner->forceFill(['type' => $type, 'sort_order' => $i, 'is_visible' => true])->save();
        }
    }
}
