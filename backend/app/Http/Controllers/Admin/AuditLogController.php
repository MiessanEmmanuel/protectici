<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListAuditLogsRequest;
use App\Http\Resources\Admin\AdminAuditLogCollection;
use App\Services\Admin\AuditLogQuery;
use Illuminate\Support\Facades\Gate;

class AuditLogController extends Controller
{
    public function __invoke(ListAuditLogsRequest $request, AuditLogQuery $logs): AdminAuditLogCollection
    {
        Gate::authorize('admin-area');

        /** @var array{event?: ?string, user_id?: ?int, auditable_type?: ?string, from?: ?string, to?: ?string, per_page?: ?int} $filters */
        $filters = $request->validated();

        return new AdminAuditLogCollection($logs->paginate($filters));
    }
}
