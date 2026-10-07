<?php

namespace Database\Seeders;

use App\Models\City;
use App\Models\CompanyType;
use App\Models\District;
use App\Models\FeedbackTopic;
use App\Models\Page;
use App\Models\PostCategory;
use App\Models\ProcedureType;
use App\Models\ReferenceModel;
use App\Models\ServiceType;
use App\Models\Setting;
use App\Models\StateForceType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Référentiels réels, tous environnements (modele.md §7.3). Idempotent (upsert sur slug).
 * Aucune donnée factice ici.
 */
class ReferenceSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $this->cities();
            $this->options(CompanyType::class, [
                'Entreprise de sécurité et sûreté agréée',
                'Établissement de certification en sécurité et sûreté',
                'Établissement de formation d\'entraînement en sécurité et sûreté',
                'Association et club',
                'Centre de formation',
                'Société de vente et d\'installation de matériel de sécurité',
            ]);
            $this->serviceTypes();
            $this->options(StateForceType::class, [
                'Police nationale (commissariat)',
                'Gendarmerie nationale',
                'Sapeurs-pompiers militaires',
            ]);
            $this->options(ProcedureType::class, [
                'Déposer une plainte',
                'Signaler un fait suspect',
                'Déclaration de perte',
                'Demander un constat d\'accident de circulation',
                'Demander une assistance des forces de l\'ordre pour une cérémonie',
            ]);
            $this->options(FeedbackTopic::class, [
                'Courtoisie des agents',
                'Rapidité d\'intervention',
                'Disponibilité',
                'Ponctualité',
                'Tenue et propreté des agents',
                'Professionnalisme et qualité du service',
                'Facturation et service après-vente',
                'Autres',
            ]);
            $this->options(PostCategory::class, [
                'Actualités',
                'Anti-intrusion',
                'Cybercriminalité',
                'Domotique',
                'Emploi',
                'Formation',
                'Sécurité incendie',
            ]);
            $this->pages();
            $this->settings();
        });
    }

    /**
     * @param  class-string<ReferenceModel>  $model
     * @param  list<string>  $names
     */
    private function options(string $model, array $names): void
    {
        $model::unguarded(function () use ($model, $names) {
            foreach ($names as $i => $name) {
                $model::updateOrCreate(
                    ['slug' => Str::slug($name)],
                    ['name' => $name, 'sort_order' => $i, 'is_visible' => true],
                );
            }
        });
    }

    private function serviceTypes(): void
    {
        $services = [
            'Alarme, contrôle d\'accès et anti-intrusion' => 'bell-ring',
            'Assistance et intervention' => 'siren',
            'Audit de sécurité' => 'clipboard-check',
            'Brigade canine' => 'dog',
            'Brigade canine de détection' => 'search',
            'Escorte' => 'car',
            'Exfiltration et évacuation' => 'door-open',
            'Formation' => 'graduation-cap',
            'Garde rapprochée' => 'user-shield',
            'Gardiennage armé' => 'shield',
            'Gardiennage non armé' => 'shield-check',
            'Hôtesse et steward de sécurité' => 'user-check',
            'Investigation et détective privé' => 'search-check',
            'Location de matériel de sécurité' => 'package',
            'Sécurité événementielle' => 'calendar-check',
            'Sécurité incendie' => 'flame',
            'Sécurité informatique' => 'lock',
            'Sécurité maritime' => 'anchor',
            'Sécurité portuaire et aéroportuaire' => 'plane',
            'Sweeping électronique' => 'radar',
            'Tracking de véhicules' => 'map-pin',
            'Veille sécuritaire' => 'eye',
            'Vente de matériel de sécurité et de sûreté' => 'shopping-cart',
            'Vidéosurveillance' => 'video',
        ];

        ServiceType::unguarded(function () use ($services) {
            $i = 0;
            foreach ($services as $name => $icon) {
                ServiceType::updateOrCreate(
                    ['slug' => Str::slug($name)],
                    ['name' => $name, 'icon' => $icon, 'sort_order' => $i++, 'is_visible' => true],
                );
            }
        });
    }

    private function cities(): void
    {
        $cities = [
            ['Abidjan', 5.3600, -4.0083],
            ['Yamoussoukro', 6.8276, -5.2893],
            ['Bouaké', 7.6906, -5.0303],
            ['San-Pédro', 4.7485, -6.6363],
            ['Daloa', 6.8774, -6.4502],
            ['Korhogo', 9.4580, -5.6297],
            ['Man', 7.4125, -7.5538],
            ['Grand-Bassam', 5.2010, -3.7390],
            ['Abengourou', 6.7297, -3.4964],
            ['Gagnoa', 6.1319, -5.9506],
            ['Divo', 5.8372, -5.3572],
            ['Bondoukou', 8.0402, -2.8000],
        ];

        City::unguarded(function () use ($cities) {
            foreach ($cities as $i => [$name, $lat, $lng]) {
                City::updateOrCreate(
                    ['slug' => Str::slug($name)],
                    ['name' => $name, 'country_code' => 'CI', 'latitude' => $lat, 'longitude' => $lng, 'sort_order' => $i, 'is_visible' => true],
                );
            }
        });

        // Communes d'Abidjan puis quartiers (coordonnées approximatives du centre).
        $abidjan = City::where('slug', 'abidjan')->firstOrFail();
        $communes = [
            'Plateau' => [5.3197, -4.0267, []],
            'Cocody' => [5.3600, -3.9900, [
                'Deux Plateaux' => [5.3770, -4.0000], 'Riviera Palmeraie' => [5.3680, -3.9650],
                'Riviera Golf' => [5.3500, -3.9600], 'Angré' => [5.4000, -3.9900], 'Blockhaus' => [5.3500, -4.0000],
                'Danga' => [5.3450, -3.9900], 'Ambassades' => [5.3650, -4.0050], 'Saint-Jean' => [5.3510, -3.9990],
            ]],
            'Marcory' => [5.3000, -3.9800, [
                'Zone 4' => [5.2850, -3.9900], 'Biétry' => [5.2900, -3.9850],
                'Résidentiel' => [5.3030, -3.9780], 'Anoumabo' => [5.2950, -4.0000],
            ]],
            'Treichville' => [5.2900, -4.0100, [
                'Arras' => [5.2940, -4.0120], 'Biafra' => [5.2900, -4.0050],
            ]],
            'Koumassi' => [5.2900, -3.9500, [
                'Remblais' => [5.2900, -3.9400], 'Prodomo' => [5.2950, -3.9550], 'Soweto' => [5.3000, -3.9450],
            ]],
            'Port-Bouët' => [5.2500, -3.9300, [
                'Vridi' => [5.2550, -3.9900], 'Gonzagueville' => [5.2600, -3.8800],
            ]],
            'Yopougon' => [5.3400, -4.0900, [
                'Niangon' => [5.3300, -4.1300], 'Sicogi' => [5.3450, -4.0700], 'Selmer' => [5.3300, -4.0850],
                'Millionnaire' => [5.3250, -4.0700], 'Toit Rouge' => [5.3500, -4.0900], 'Siporex' => [5.3600, -4.0800],
            ]],
            'Abobo' => [5.4200, -4.0200, [
                'Abobo-Baoulé' => [5.4350, -4.0100], 'Avocatier' => [5.4150, -4.0250], 'Sagbé' => [5.4100, -4.0150],
            ]],
            'Adjamé' => [5.3600, -4.0300, [
                'Williamsville' => [5.3700, -4.0300], 'Liberté' => [5.3550, -4.0250], '220 Logements' => [5.3500, -4.0350],
            ]],
            'Attécoubé' => [5.3400, -4.0400, [
                'Locodjro' => [5.3450, -4.0500],
            ]],
            'Bingerville' => [5.3550, -3.8900, []],
            'Songon' => [5.3200, -4.2600, []],
            'Anyama' => [5.4950, -4.0500, []],
        ];

        District::unguarded(function () use ($abidjan, $communes) {
            foreach ($communes as $name => [$lat, $lng, $quartiers]) {
                $commune = District::updateOrCreate(
                    ['city_id' => $abidjan->id, 'slug' => Str::slug($name)],
                    ['parent_id' => null, 'name' => $name, 'latitude' => $lat, 'longitude' => $lng, 'is_visible' => true],
                );
                foreach ($quartiers as $quartier => [$qLat, $qLng]) {
                    District::updateOrCreate(
                        ['city_id' => $abidjan->id, 'slug' => Str::slug($quartier)],
                        ['parent_id' => $commune->id, 'name' => $quartier, 'latitude' => $qLat, 'longitude' => $qLng, 'is_visible' => true],
                    );
                }
            }
        });
    }

    private function pages(): void
    {
        // Pages légales créées vides et non publiées : le texte doit être validé (juriste) avant publication.
        $pages = [
            'qui-sommes-nous' => 'Qui sommes-nous',
            'mentions-legales' => 'Mentions légales',
            'politique-de-confidentialite' => 'Politique de confidentialité',
            'conditions-generales-d-utilisation' => 'Conditions générales d\'utilisation',
        ];

        Page::unguarded(function () use ($pages) {
            foreach ($pages as $slug => $title) {
                $page = Page::withTrashed()->firstOrNew(['slug' => $slug]);
                if (! $page->exists) {
                    $page->forceFill(['title' => $title, 'body' => '', 'is_visible' => false])->save();
                }
            }
        });
    }

    private function settings(): void
    {
        $settings = [
            'contact.phone' => '+225 07 09 44 51 11',
            'contact.email' => 'info@protectici.ci',
            'site.address' => 'Abidjan Plateau, immeuble Eden',
            'site.name' => 'ProtectIci',
            'social.facebook' => '',
            'social.twitter' => '',
            'social.linkedin' => '',
            'social.instagram' => '',
        ];

        Setting::unguarded(function () use ($settings) {
            foreach ($settings as $key => $value) {
                $setting = Setting::firstOrNew(['key' => $key]);
                if (! $setting->exists) {
                    $setting->forceFill(['value' => $value, 'is_public' => true])->save();
                }
            }
        });
    }
}
