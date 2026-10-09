<?php

namespace App\Http\Controllers\Establishments;

use App\Http\Requests\Establishment\UploadMediaRequest;
use App\Models\Media;
use App\Services\Media\MediaManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class MediaController extends OwnerController
{
    public function store(UploadMediaRequest $request, string $type, string $slug, MediaManager $media): JsonResponse
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('updateOwn', $establishment);

        $created = $media->store($establishment, $request->file('file'), $request->validated('collection'), $request->validated('alt'));

        return response()->json(['data' => [
            'id' => $created->id,
            'collection' => $created->collection,
            'url' => $created->url(),
            'alt' => $created->alt_text,
        ]], 201);
    }

    public function destroy(Request $request, string $type, string $slug, int $id, MediaManager $media): Response
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('updateOwn', $establishment);

        $item = Media::query()
            ->where('mediable_type', $establishment->getMorphClass())
            ->where('mediable_id', $establishment->getKey())
            ->findOrFail($id);

        $media->destroy($establishment, $item);

        return response()->noContent();
    }
}
