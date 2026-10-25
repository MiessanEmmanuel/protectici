<?php

namespace App\Console\Commands\Retention;

use App\Services\AuditLogger;
use App\Services\Feedback\VoiceNoteStore;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Anonymisation des « Dis-moi tout » clos depuis plus de 36 mois. Le message vocal (donnée personnelle) est supprimé
 * du stockage et ses colonnes voice_* remises à null, y compris pour un dossier déjà anonymisé qui en aurait encore un.
 * Si un fichier ne peut pas être supprimé, sa référence est conservée et la commande réessaiera au prochain passage.
 */
class AnonymizeFeedbacks extends RetentionCommand
{
    protected $signature = 'retention:anonymize-feedbacks';

    protected $description = 'Anonymise les « Dis-moi tout » clos depuis plus de 36 mois (y compris supprimés logiquement)';

    public function handle(AuditLogger $audit, VoiceNoteStore $voiceNotes): int
    {
        $threshold = now()->subMonthsNoOverflow(36);
        $count = 0;
        $failedIds = [];

        do {
            $rows = DB::table('feedbacks')
                ->whereNotNull('resolved_at')->where('resolved_at', '<', $threshold)
                ->whereNotIn('id', $failedIds)
                ->where(fn (Builder $q) => $q->whereNotNull('email')->orWhereNotNull('phone')->orWhereNotNull('civility')
                    ->orWhereNotNull('user_id')->orWhereNotNull('ip_hash')->orWhereNotNull('voice_path')
                    ->orWhere('first_name', '<>', 'Anonymisé')->orWhere('last_name', '<>', 'Anonymisé'))
                ->orderBy('id')->limit(self::BATCH)->get(['id', 'voice_disk', 'voice_path']);

            $voiceCleared = [];
            foreach ($rows as $row) {
                if ($row->voice_path === null) {
                    continue;
                }
                if ($voiceNotes->delete($row->voice_disk, $row->voice_path)) {
                    $voiceCleared[] = $row->id;
                } else {
                    $failedIds[] = $row->id;
                }
            }

            $ids = $rows->pluck('id');
            $count += DB::table('feedbacks')->whereIn('id', $ids)->update([
                'first_name' => 'Anonymisé', 'last_name' => 'Anonymisé', 'email' => null, 'phone' => null,
                'civility' => null, 'user_id' => null, 'ip_hash' => null,
            ]);

            if ($voiceCleared !== []) {
                DB::table('feedbacks')->whereIn('id', $voiceCleared)->update([
                    'voice_disk' => null, 'voice_path' => null, 'voice_mime' => null,
                    'voice_size_bytes' => null, 'voice_duration_seconds' => null,
                ]);
            }
        } while ($rows->count() === self::BATCH);

        $this->audit($audit, 'retention_anonymize', $count, $threshold);
        $this->info("{$count} « Dis-moi tout » anonymisé(s).");
        if ($failedIds !== []) {
            $this->warn(count($failedIds).' message(s) vocal(aux) non supprimé(s) : nouvel essai au prochain passage.');
        }

        return $failedIds === [] ? self::SUCCESS : self::FAILURE;
    }
}
