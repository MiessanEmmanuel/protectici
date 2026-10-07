<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CityResource;
use App\Http\Resources\OptionResource;
use App\Models\City;
use App\Models\CompanyType;
use App\Models\ProcedureType;
use App\Models\ServiceType;
use App\Models\StateForceType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReferenceDataController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = Cache::remember('reference-data:v1', 300, function () use ($request) {
            $cities = City::query()->visible()->orderBy('sort_order')->orderBy('name')
                ->with(['districts' => fn ($q) => $q->where('districts.is_visible', true)->orderBy('name')])
                ->get();

            return json_decode(json_encode([
                'cities' => CityResource::collection($cities)->resolve($request),
                'company_types' => OptionResource::collection(CompanyType::visible()->ordered()->get())->resolve($request),
                'service_types' => OptionResource::collection(ServiceType::visible()->ordered()->get())->resolve($request),
                'state_force_types' => OptionResource::collection(StateForceType::visible()->ordered()->get())->resolve($request),
                'procedure_types' => OptionResource::collection(ProcedureType::visible()->ordered()->get())->resolve($request),
            ]), true);
        });

        return response()->json(['data' => $data])->header('Cache-Control', 'public, max-age=300');
    }
}
