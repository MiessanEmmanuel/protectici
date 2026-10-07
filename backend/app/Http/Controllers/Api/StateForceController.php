<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ListStateForcesRequest;
use App\Http\Resources\StateForceDetailResource;
use App\Http\Resources\StateForceSummaryCollection;
use App\Models\StateForce;
use App\Services\Directory\StateForceSearch;

class StateForceController extends Controller
{
    public function __construct(private readonly StateForceSearch $search) {}

    public function index(ListStateForcesRequest $request): StateForceSummaryCollection
    {
        $page = $this->search->listing($request->filters())
            ->paginate($request->perPage())
            ->withQueryString();

        return new StateForceSummaryCollection($page);
    }

    public function show(StateForce $stateForce): StateForceDetailResource
    {
        $stateForce->load(['forceType', 'city', 'district', 'procedureTypes']);

        return new StateForceDetailResource($stateForce);
    }
}
