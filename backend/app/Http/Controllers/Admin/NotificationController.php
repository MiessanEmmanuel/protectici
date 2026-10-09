<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListNotificationsRequest;
use App\Http\Resources\Admin\AdminNotificationCollection;
use App\Http\Resources\Admin\AdminNotificationResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Notifications internes de l'administrateur CONNECTÉ uniquement (jamais celles d'un autre). */
class NotificationController extends Controller
{
    public function index(ListNotificationsRequest $request): AdminNotificationCollection
    {
        Gate::authorize('admin-area');
        $admin = $this->admin($request);

        $page = $admin->notifications()->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(min(50, max(1, (int) $request->input('per_page', 20))))->withQueryString();

        return (new AdminNotificationCollection($page))
            ->withUnreadCount($admin->unreadNotifications()->count());
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        Gate::authorize('admin-area');

        // Recherche limitée aux notifications de l'administrateur : celle d'un autre = 404.
        $notification = $this->admin($request)->notifications()->whereKey($id)->firstOrFail();
        $notification->markAsRead();

        return response()->json(['data' => AdminNotificationResource::make($notification->refresh())->resolve()]);
    }

    private function admin(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
