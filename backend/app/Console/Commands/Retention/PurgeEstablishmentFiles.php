<?php

namespace App\Console\Commands\Retention;

use App\Models\EstablishmentClaim;
use App\Models\Media;
use App\Models\Provider;
use App\Models\ProviderDocument;
use App\Models\StateForce;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Supprime PHYSIQUEMENT (fichier puis ligne) les justificatifs et médias :
 *  - des prestataires / forces étatiques supprimés logiquement depuis plus de 30 jours. Cela couvre aussi les fiches
 *    dont le propriétaire a été anonymisé/purgé (user_id NULL) : une fiche orpheline n'est supprimée que logiquement,
 *    c'est donc la même condition (fiche supprimée > 30 j) ;
 *  - des justificatifs / médias eux-mêmes supprimés logiquement depuis plus de 30 jours ;
 *  - des justificatifs de revendication (establishment_claims) portant sur ces fiches : fichier supprimé, métadonnées
 *    effacées, la demande elle-même est conservée (historique de décision).
 * Un fichier absent du disque n'est pas une erreur ; une erreur d'E/S laisse la ligne en place (nouvelle tentative le lendemain).
 */
class PurgeEstablishmentFiles extends RetentionCommand
{
    protected $signature = 'retention:purge-establishment-files';

    protected $description = 'Supprime les justificatifs et médias des fiches supprimées depuis plus de 30 jours';

    public function handle(AuditLogger $audit): int
    {
        $threshold = now()->subDays(30);
        $count = 0;
        $failed = 0;

        $providers = Provider::onlyTrashed()->where('deleted_at', '<', $threshold)->select('id');
        $forces = StateForce::onlyTrashed()->where('deleted_at', '<', $threshold)->select('id');

        ProviderDocument::withTrashed()
            ->where(fn (Builder $q) => $q->where('deleted_at', '<', $threshold)
                ->orWhereIn('provider_id', $providers)->orWhereIn('state_force_id', $forces))
            ->chunkById(self::BATCH, function ($documents) use (&$count, &$failed): void {
                foreach ($documents as $document) {
                    $this->purge($document, $count, $failed);
                }
            });

        Media::withTrashed()
            ->where(fn (Builder $q) => $q->where('deleted_at', '<', $threshold)
                ->orWhere(fn (Builder $q) => $q->where('mediable_type', 'provider')->whereIn('mediable_id', $providers))
                ->orWhere(fn (Builder $q) => $q->where('mediable_type', 'state_force')->whereIn('mediable_id', $forces)))
            ->chunkById(self::BATCH, function ($medias) use (&$count, &$failed): void {
                foreach ($medias as $media) {
                    $this->purge($media, $count, $failed);
                }
            });

        EstablishmentClaim::query()
            ->whereNotNull('document_path')
            ->where(fn (Builder $q) => $q->whereIn('provider_id', $providers)->orWhereIn('state_force_id', $forces))
            ->chunkById(self::BATCH, function ($claims) use (&$count, &$failed): void {
                foreach ($claims as $claim) {
                    $this->purgeClaimDocument($claim, $count, $failed);
                }
            });

        $this->audit($audit, 'retention_purge', $count, $threshold);
        $this->info("{$count} fichier(s) supprimé(s), {$failed} en échec.");

        return self::SUCCESS;
    }

    private function purge(ProviderDocument|Media $file, int &$count, int &$failed): void
    {
        try {
            Storage::disk($file->disk)->delete($file->path);
        } catch (\Throwable $e) {
            $failed++;
            Log::warning('Rétention : suppression de fichier impossible.', ['model' => $file->getMorphClass(), 'id' => $file->getKey()]);

            return;
        }

        $file->forceDelete();
        $count++;
    }

    private function purgeClaimDocument(EstablishmentClaim $claim, int &$count, int &$failed): void
    {
        try {
            Storage::disk($claim->document_disk)->delete((string) $claim->document_path);
        } catch (\Throwable $e) {
            $failed++;
            Log::warning('Rétention : suppression de justificatif de revendication impossible.', ['id' => $claim->getKey()]);

            return;
        }

        $claim->forceFill([
            'document_path' => null, 'document_original_name' => null, 'document_mime_type' => null, 'document_size_bytes' => null,
        ])->save();
        $count++;
    }
}
