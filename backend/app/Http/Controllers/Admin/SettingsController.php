<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\SaveSettingsRequest;
use App\Models\Setting;
use App\Models\User;
use App\Services\Content\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Paramètres du site (admin + 2FA) : clés en liste blanche, audit à chaque changement. */
class SettingsController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('admin-area');

        return response()->json(['data' => $this->rows()]);
    }

    public function update(SaveSettingsRequest $request, SiteSettings $settings): JsonResponse
    {
        Gate::authorize('admin-area');
        /** @var User $actor */
        $actor = $request->user();
        $settings->save($actor, $request->items());

        return response()->json(['data' => $this->rows()]);
    }

    /** @return list<array{key: string, value: mixed, is_public: bool}> */
    private function rows(): array
    {
        $stored = Setting::query()->whereIn('key', SiteSettings::KEYS)->get()->keyBy('key');
        $rows = [];
        foreach (SiteSettings::KEYS as $key) {
            $s = $stored->get($key);
            $rows[] = $s === null
                ? ['key' => $key, 'value' => '', 'is_public' => false]
                : ['key' => $key, 'value' => $s->value, 'is_public' => $s->is_public];
        }

        return $rows;
    }
}
