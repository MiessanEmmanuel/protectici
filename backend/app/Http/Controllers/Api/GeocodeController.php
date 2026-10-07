<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiHttpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\GeocodeRequest;
use App\Services\Geocoding\Geocoder;
use App\Services\Geocoding\GeocodingUnavailableException;
use Illuminate\Http\JsonResponse;

class GeocodeController extends Controller
{
    public function __invoke(GeocodeRequest $request, Geocoder $geocoder): JsonResponse
    {
        try {
            $results = $geocoder->search(trim($request->validated('q')));
        } catch (GeocodingUnavailableException) {
            throw new ApiHttpException(503, 'Le service de géocodage est momentanément indisponible.', ['Retry-After' => '30']);
        }

        return response()->json(['data' => $results]);
    }
}
