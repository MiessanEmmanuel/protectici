<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use App\Models\ProviderDocument;
use App\Models\StateForce;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Téléchargement d'un justificatif privé : flux serveur, jamais d'URL publique ; chaque accès est journalisé. */
class DocumentDownloadController extends Controller
{
    public function __invoke(int $id, AuditLogger $audit): StreamedResponse
    {
        Gate::authorize('admin-area');

        $document = ProviderDocument::query()->findOrFail($id);
        $disk = Storage::disk($document->disk);
        abort_unless($disk->exists($document->path), 404);

        $owner = $document->provider_id !== null
            ? Provider::query()->find($document->provider_id)
            : StateForce::query()->find($document->state_force_id);
        $audit->record('document_downloaded', $owner, null, null, ['document_id' => $document->id, 'type' => $document->type]);

        $extension = match ($document->mime_type) {
            'application/pdf' => 'pdf', 'image/png' => 'png', default => 'jpg',
        };

        return response()->streamDownload(function () use ($disk, $document): void {
            $stream = $disk->readStream($document->path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, 'justificatif-'.$document->id.'.'.$extension, [
            'Content-Type' => $document->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ], 'attachment');
    }
}
