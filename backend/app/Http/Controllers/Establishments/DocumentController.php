<?php

namespace App\Http\Controllers\Establishments;

use App\Enums\EstablishmentType;
use App\Http\Requests\Establishment\UploadDocumentRequest;
use App\Http\Resources\Establishments\MyEstablishmentResource;
use App\Models\ProviderDocument;
use App\Services\Establishments\EstablishmentNotifier;
use App\Services\Media\DocumentManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class DocumentController extends OwnerController
{
    public function store(UploadDocumentRequest $request, string $type, string $slug, DocumentManager $documents, EstablishmentNotifier $notifier): JsonResponse
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('updateOwn', $establishment);

        $document = $documents->store($establishment, $request->file('file'), $request->validated('type'));
        $notifier->documentUploaded($establishment);

        $data = MyEstablishmentResource::document($document);
        unset($data['verified_at']);

        return response()->json(['data' => $data], 201);
    }

    public function destroy(Request $request, string $type, string $slug, int $id, DocumentManager $documents): Response
    {
        $establishment = $this->owned($request, $type, $slug);
        Gate::authorize('updateOwn', $establishment);

        $document = ProviderDocument::query()
            ->where(EstablishmentType::tryFromModel($establishment)->foreignKey(), $establishment->getKey())
            ->findOrFail($id);

        $documents->destroy($establishment, $document);

        return response()->noContent();
    }
}
