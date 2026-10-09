<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\AdminAuditLogResource;
use App\Services\Admin\DashboardStats;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class DashboardController extends Controller
{
    public function __invoke(Request $request, DashboardStats $stats): JsonResponse
    {
        Gate::authorize('admin-area');

        return response()->json(['data' => $stats->counters() + [
            'recent_audit' => AdminAuditLogResource::collection($stats->recentAudit())->resolve($request),
        ]]);
    }
}
