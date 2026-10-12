<?php

namespace App\Http\Controllers\Content;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\UploadContentMediaRequest;
use App\Models\User;
use App\Services\Content\ContentMediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class MediaController extends Controller
{
    public function store(UploadContentMediaRequest $request, ContentMediaService $media): JsonResponse
    {
        Gate::authorize('content-area');
        /** @var User $user */
        $user = $request->user();
        $created = $media->store($user, $request->file('file'), (string) $request->validated('alt'));

        return response()->json(['data' => ['id' => $created->id, 'url' => $created->url(), 'alt' => $created->alt_text]], 201);
    }
}
