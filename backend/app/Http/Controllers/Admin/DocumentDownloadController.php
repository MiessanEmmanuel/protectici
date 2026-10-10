<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use App\Models\ProviderDocument;
use App\Models\StateForce;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Téléchargement d'un justificatif privé ; chaque accès est journalisé. Disque local : flux serveur. Disque S3/R2 :
 * redirection 302 vers une URL signée à courte durée (5 min par défaut, 10 max), en pièce jointe, sans appel réseau
 * préalable (la signature est calculée localement) ; jamais d'URL publique.
 */
class DocumentDownloadController extends Controller
{
    public function __invoke(int $id, AuditLogger $audit): StreamedResponse|RedirectResponse
    {
        Gate::authorize('admin-area');

        $document = ProviderDocument::query()->findOrFail($id);
        $remote = config("filesystems.disks.{$document->disk}.driver") === 's3';
        $disk = Storage::disk($document->disk);
        abort_unless($remote || $disk->exists($document->path), 404);

        $owner = $document->provider_id !== null
            ? Provider::query()->find($document->provider_id)
            : StateForce::query()->find($document->state_force_id);
        $audit->record('document_downloaded', $owner, null, null, ['document_id' => $document->id, 'type' => $document->type]);

        $extension = match ($document->mime_type) {
            'application/pdf' => 'pdf', 'image/png' => 'png', default => 'jpg',
        };

        $filename = 'justificatif-'.$document->id.'.'.$extension;

        if ($remote) {
            $ttl = max(1, min(10, (int) config('establishments.documents.signed_url_ttl_minutes', 5)));
            $url = $disk->temporaryUrl($document->path, now()->addMinutes($ttl), [
                'ResponseContentDisposition' => 'attachment; filename="'.$filename.'"',
                'ResponseContentType' => $document->mime_type,
            ]);

            return redirect()->away($url)->withHeaders(['Cache-Control' => 'private, no-store']);
        }

        return response()->streamDownload(function () use ($disk, $document): void {
            $stream = $disk->readStream($document->path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $filename, [
            'Content-Type' => $document->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ], 'attachment');
    }
}
