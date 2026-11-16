<?php

namespace Database\Seeders;

use App\Models\City;
use App\Models\District;
use App\Models\Provider;
use App\Models\ProviderBranch;
use Illuminate\Database\Seeder;

/** Agences factices (adresses fictives) de quelques prestataires de démonstration. Rejouable sans doublon. */
class DemoBranchesSeeder extends Seeder
{
    /** Prestataire => [libellé, quartier, latitude, longitude]. */
    private const BRANCHES = [
        'Dauphin Sécurité' => [
            ['Agence de Yopougon', 'niangon', 5.3340, -4.0880],
            ['Agence de Marcory', 'zone-4', 5.2980, -3.9860],
        ],
        'Puissance 6 Security' => [
            ['Agence du Plateau', 'plateau', 5.3220, -4.0170],
        ],
    ];

    public function run(): void
    {
        $abidjan = City::where('slug', 'abidjan')->firstOrFail();

        foreach (self::BRANCHES as $providerName => $branches) {
            $provider = Provider::where('name', $providerName)->first();
            if ($provider === null) {
                continue;
            }

            foreach ($branches as $order => [$label, $district, $lat, $lng]) {
                ProviderBranch::updateOrCreate(
                    ['provider_id' => $provider->id, 'label' => $label],
                    [
                        'city_id' => $abidjan->id,
                        'district_id' => District::where('city_id', $abidjan->id)->where('slug', $district)->value('id'),
                        'address' => ($order + 1).' rue de la Démonstration (adresse fictive)',
                        'phone' => '+22507000001'.str_pad((string) $order, 2, '0', STR_PAD_LEFT),
                        'latitude' => $lat,
                        'longitude' => $lng,
                        'sort_order' => $order,
                    ],
                );
            }
        }
    }
}
