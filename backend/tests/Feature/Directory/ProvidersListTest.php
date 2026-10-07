<?php

use App\Models\City;
use App\Models\CompanyType;
use App\Models\District;
use App\Models\Provider;
use App\Models\Review;
use App\Models\ServiceType;
use Illuminate\Support\Facades\DB;

it('liste les prestataires publiés au format du contrat', function () {
    $city = City::factory()->create();
    $service = ServiceType::factory()->create();
    $p = makeProvider(['name' => 'Alpha Garde'], $city);
    $p->serviceTypes()->attach($service);

    $response = $this->getJson('/api/v1/providers')->assertOk();

    $response->assertJsonStructure(['data' => [SUMMARY_KEYS], 'meta' => ['current_page', 'last_page', 'per_page', 'total'], 'links' => ['next', 'prev']]);
    expect(array_keys($response->json('data.0')))->toEqualCanonicalizing(SUMMARY_KEYS);
    expect($response->json('meta'))->toBe(['current_page' => 1, 'last_page' => 1, 'per_page' => 12, 'total' => 1]);
    expect($response->json('data.0.services.0'))->toBe(['slug' => $service->slug, 'name' => $service->name]);
    expect($response->json('data.0.distance_m'))->toBeNull();
});

it('n\'expose jamais les fiches non publiées ni supprimées', function () {
    $city = City::factory()->create();
    $ok = makeProvider(['name' => 'Visible'], $city);
    $pending = makeProvider(['name' => 'Attente', 'status' => 'pending', 'is_visible' => false], $city);
    $rejected = Provider::factory()->rejected()->create(['city_id' => $city->id]);
    $suspended = Provider::factory()->suspended()->create(['city_id' => $city->id]);
    $hidden = Provider::factory()->hidden()->create(['city_id' => $city->id]);
    $deleted = makeProvider(['name' => 'Supprimée'], $city);
    $deleted->delete();

    $slugs = collect($this->getJson('/api/v1/providers')->assertOk()->json('data'))->pluck('slug')->all();
    expect($slugs)->toBe([$ok->slug]);

    foreach ([$pending, $rejected, $suspended, $hidden, $deleted] as $p) {
        $this->getJson('/api/v1/providers/'.$p->slug)->assertNotFound();
        $this->getJson('/api/v1/providers/'.$p->slug.'/reviews')->assertNotFound();
        $this->postJson('/api/v1/providers/'.$p->slug.'/view')->assertNotFound();
    }
});

it('filtre par ville, quartier (commune incluant ses quartiers), service et type d\'entreprise', function () {
    $abidjan = City::factory()->create(['slug' => 'abidjan']);
    $bouake = City::factory()->create(['slug' => 'bouake']);
    $cocody = District::factory()->create(['city_id' => $abidjan->id, 'slug' => 'cocody']);
    $angre = District::factory()->create(['city_id' => $abidjan->id, 'slug' => 'angre', 'parent_id' => $cocody->id]);
    $plateau = District::factory()->create(['city_id' => $abidjan->id, 'slug' => 'plateau']);
    $gardiennage = ServiceType::factory()->create(['slug' => 'gardiennage']);
    $video = ServiceType::factory()->create(['slug' => 'video']);
    $type = CompanyType::factory()->create(['slug' => 'agree']);

    $a = makeProvider(['district_id' => $angre->id], $abidjan);
    $a->serviceTypes()->attach($gardiennage);
    $a->companyTypes()->attach($type);
    $b = makeProvider(['district_id' => $plateau->id], $abidjan);
    $b->serviceTypes()->attach($video);
    $c = makeProvider([], $bouake);

    $get = fn (string $qs) => collect($this->getJson('/api/v1/providers?'.$qs)->assertOk()->json('data'))->pluck('slug')->sort()->values()->all();

    expect($get('filter[city]=bouake'))->toBe([$c->slug]);
    expect($get('filter[district]=cocody'))->toBe([$a->slug]);
    expect($get('filter[district]=angre'))->toBe([$a->slug]);
    expect($get('filter[service]=gardiennage,video'))->toBe(collect([$a->slug, $b->slug])->sort()->values()->all());
    expect($get('filter[service]=video'))->toBe([$b->slug]);
    expect($get('filter[company_type]=agree'))->toBe([$a->slug]);
    expect($get('filter[city]=inconnue'))->toBe([]);
});

it('recherche plein texte tolérante aux accents et aux fautes', function () {
    $city = City::factory()->create();
    $dauphin = makeProvider(['name' => 'Dauphin Sécurité', 'description' => 'Gardiennage et vidéosurveillance à Abidjan'], $city);
    makeProvider(['name' => 'Royal Force', 'description' => 'Hôtesses'], $city);

    $search = fn (string $q) => collect($this->getJson('/api/v1/providers?'.http_build_query(['filter' => ['q' => $q]]))->assertOk()->json('data'))->pluck('slug')->all();

    expect($search('dauphin'))->toBe([$dauphin->slug]);
    expect($search('securite'))->toBe([$dauphin->slug]);   // sans accent
    expect($search('dauphn'))->toBe([$dauphin->slug]);     // faute de frappe
    expect($search('videosurveillance'))->toBe([$dauphin->slug]); // description
    expect($search('zzzzqqq'))->toBe([]);
});

it('neutralise les caractères spéciaux et tentatives d\'injection dans la recherche', function () {
    makeProvider(['name' => 'Alpha']);

    foreach (["'; DROP TABLE providers; --", '%', '_', '\\', '" OR 1=1', '& | ! (', "alpha' OR '1'='1"] as $q) {
        $this->getJson('/api/v1/providers?'.http_build_query(['filter' => ['q' => $q]]))->assertOk();
    }
    expect(DB::table('providers')->count())->toBe(1);
});

it('trie par nom, note et popularité', function () {
    $city = City::factory()->create();
    $b = makeProvider(['name' => 'Bravo', 'rating_avg' => 0, 'views_count' => 5], $city);
    $a = makeProvider(['name' => 'Alpha', 'views_count' => 500], $city);
    $c = makeProvider(['name' => 'Charlie'], $city);
    Review::factory()->rating(5)->create(['provider_id' => $c->id]);
    Review::factory()->rating(3)->create(['provider_id' => $b->id]);

    $order = fn (string $sort) => collect($this->getJson('/api/v1/providers?sort='.$sort)->assertOk()->json('data'))->pluck('name')->all();

    expect($order('name'))->toBe(['Alpha', 'Bravo', 'Charlie']);
    expect($order('-rating'))->toBe(['Charlie', 'Bravo', 'Alpha']);
    expect($order('-popular')[0])->toBe('Alpha');
});

it('pagine et plafonne per_page à 50', function () {
    $city = City::factory()->create();
    Provider::factory()->count(7)->create(['city_id' => $city->id]);

    $r = $this->getJson('/api/v1/providers?per_page=5')->assertOk();
    expect($r->json('data'))->toHaveCount(5);
    expect($r->json('meta.per_page'))->toBe(5)->and($r->json('meta.last_page'))->toBe(2)->and($r->json('meta.total'))->toBe(7);
    expect($r->json('links.next'))->not->toBeNull()->and($r->json('links.prev'))->toBeNull();

    $this->getJson('/api/v1/providers?per_page=5&page=2')->assertOk()->assertJsonCount(2, 'data');
    expect($this->getJson('/api/v1/providers?per_page=500')->assertOk()->json('meta.per_page'))->toBe(50);
});

it('valide les paramètres (liste blanche)', function (string $qs, string $field) {
    $this->getJson('/api/v1/providers?'.$qs)->assertUnprocessable()->assertJsonValidationErrors($field)
        ->assertJsonStructure(['message', 'errors']);
})->with([
    'lat sans lng' => ['lat=5.3', 'lng'],
    'lat hors bornes' => ['lat=95&lng=-4', 'lat'],
    'rayon > 50' => ['lat=5.3&lng=-4&radius_km=100', 'radius_km'],
    'tri inconnu' => ['sort=-created_at', 'sort'],
    'tri distance sans coordonnées' => ['sort=distance', 'lat'],
    'slug invalide' => ['filter[city]=Abidjan;DROP', 'filter.city'],
    'liste de services invalide' => ['filter[service]=a b,c', 'filter.service'],
    'recherche trop longue' => ['filter[q]='.str_repeat('a', 101), 'filter.q'],
    'page invalide' => ['page=0', 'page'],
    'per_page invalide' => ['per_page=0', 'per_page'],
]);

it('ne fuit aucun champ privé', function () {
    makeProvider();
    $json = json_encode($this->getJson('/api/v1/providers')->json());

    foreach (['user_id', 'status', 'rejection_reason', 'reviewed_by', 'search_vector', 'location', 'ip_hash', 'rccm', 'approval_number'] as $leak) {
        expect($json)->not->toContain('"'.$leak.'"');
    }
});

it('liste les prestataires populaires (limite)', function () {
    $city = City::factory()->create();
    Provider::factory()->count(3)->create(['city_id' => $city->id]);
    $top = Provider::factory()->featured()->create(['city_id' => $city->id]);
    Provider::factory()->pending()->create(['city_id' => $city->id, 'is_featured' => true]);

    $r = $this->getJson('/api/v1/providers/popular?limit=2')->assertOk();
    expect($r->json('data'))->toHaveCount(2)->and($r->json('data.0.slug'))->toBe($top->slug);
    $this->getJson('/api/v1/providers/popular?limit=21')->assertUnprocessable();
    $this->getJson('/api/v1/providers/popular')->assertOk()->assertJsonCount(4, 'data');
});
