<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Claims\ListClaimsRequest;
use App\Http\Requests\Establishment\ReasonRequest;
use App\Http\Resources\Claims\AdminClaimResource;
use App\Models\EstablishmentClaim;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Claims\ClaimService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Traitement des revendications par l'administration (contrat §10.3, rôle admin + 2FA). */
class ClaimController extends Controller
{
    public function index(ListClaimsRequest $request): JsonResponse
    {
        $page = EstablishmentClaim::query()
            ->with(ClaimService::relations())
            ->where('status', $request->validated('status') ?? 'pending')
            ->orderByDesc('id')
            ->paginate($request->perPage());

        return ApiPage::response($page, AdminClaimResource::collection($page->getCollection())->resolve($request));
    }

    public function show(Request $request, int $id, ClaimService $claims): JsonResponse
    {
        $claim = EstablishmentClaim::query()->findOrFail($id);
        Gate::authorize('view', $claim);

        return $this->respond($request, $claims->load($claim));
    }

    public function approve(Request $request, int $id, ClaimService $claims): JsonResponse
    {
        Gate::authorize('review', EstablishmentClaim::class);

        return $this->respond($request, $claims->approve($id, $this->admin($request)));
    }

    public function reject(ReasonRequest $request, int $id, ClaimService $claims): JsonResponse
    {
        Gate::authorize('review', EstablishmentClaim::class);

        return $this->respond($request, $claims->reject($id, $this->admin($request), (string) $request->validated('reason')));
    }

    /**
     * Justificatif privé, en pièce jointe ; chaque accès est journalisé (sans chemin ni nom de fichier).
     * Disque local : flux serveur. Disque S3/R2 : URL signée à courte durée (≤ 10 min), jamais d'URL publique.
     */
    public function document(int $id, AuditLogger $audit): StreamedResponse|RedirectResponse
    {
        $claim = EstablishmentClaim::query()->findOrFail($id);
        Gate::authorize('review', $claim);
        abort_if($claim->document_path === null, 404);

        $path = $claim->document_path;
        $mime = (string) $claim->document_mime_type;
        $remote = config("filesystems.disks.{$claim->document_disk}.driver") === 's3';
        $disk = Storage::disk($claim->document_disk);
        abort_unless($remote || $disk->exists($path), 404);

        $establishment = $claim->provider_id !== null
            ? $claim->provider()->withTrashed()->first()
            : $claim->stateForce()->withTrashed()->first();
        $audit->record('claim_document_downloaded', $establishment, null, null, ['claim_id' => $claim->id]);

        $extension = match ($mime) {
            'application/pdf' => 'pdf', 'image/png' => 'png', default => 'jpg',
        };
        $filename = 'revendication-'.$claim->id.'.'.$extension;

        if ($remote) {
            $ttl = max(1, min(10, (int) config('establishments.documents.signed_url_ttl_minutes', 5)));
            $url = $disk->temporaryUrl($path, now()->addMinutes($ttl), [
                'ResponseContentDisposition' => 'attachment; filename="'.$filename.'"',
                'ResponseContentType' => $mime,
            ]);

            return redirect()->away($url)->withHeaders(['Cache-Control' => 'private, no-store']);
        }

        return response()->streamDownload(function () use ($disk, $path): void {
            $stream = $disk->readStream($path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $filename, [
            'Content-Type' => $mime,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ], 'attachment');
    }

    private function respond(Request $request, EstablishmentClaim $claim): JsonResponse
    {
        return response()->json(['data' => (new AdminClaimResource($claim))->resolve($request)]);
    }

    private function admin(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
