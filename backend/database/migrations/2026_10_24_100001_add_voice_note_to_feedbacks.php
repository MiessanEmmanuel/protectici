<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * « Dis-moi tout » : commentaire vocal (api-contract §8.2 bis). Le fichier reste sur un disque privé ; seules ses
 * métadonnées sont en base. Le commentaire écrit devient facultatif (un commentaire OU un vocal, règle applicative :
 * après anonymisation, un dossier vocal seul n'a plus ni l'un ni l'autre). Additive et réversible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->string('voice_disk', 50)->nullable();
            $table->string('voice_path', 255)->nullable();
            $table->string('voice_mime', 50)->nullable();
            $table->unsignedInteger('voice_size_bytes')->nullable();
            $table->unsignedSmallInteger('voice_duration_seconds')->nullable();
        });

        DB::statement('ALTER TABLE feedbacks ALTER COLUMN comment DROP NOT NULL');
        DB::statement("ALTER TABLE feedbacks ADD CONSTRAINT feedbacks_voice_mime_chk CHECK (voice_mime IS NULL OR voice_mime IN ('audio/webm','audio/mp4','audio/ogg'))");
        DB::statement('ALTER TABLE feedbacks ADD CONSTRAINT feedbacks_voice_duration_chk CHECK (voice_duration_seconds IS NULL OR voice_duration_seconds BETWEEN 1 AND 120)');
        DB::statement('ALTER TABLE feedbacks ADD CONSTRAINT feedbacks_voice_size_chk CHECK (voice_size_bytes IS NULL OR voice_size_bytes > 0)');
        // Les métadonnées vont ensemble : toutes renseignées ou toutes nulles.
        DB::statement('ALTER TABLE feedbacks ADD CONSTRAINT feedbacks_voice_complete_chk CHECK ('
            .'(voice_path IS NULL AND voice_disk IS NULL AND voice_mime IS NULL AND voice_size_bytes IS NULL AND voice_duration_seconds IS NULL) OR '
            .'(voice_path IS NOT NULL AND voice_disk IS NOT NULL AND voice_mime IS NOT NULL AND voice_size_bytes IS NOT NULL AND voice_duration_seconds IS NOT NULL))');
        // Retrouver rapidement les vocaux à purger (rétention).
        DB::statement('CREATE INDEX feedbacks_voice_path_idx ON feedbacks (id) WHERE voice_path IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS feedbacks_voice_path_idx');
        foreach (['voice_complete_chk', 'voice_size_chk', 'voice_duration_chk', 'voice_mime_chk'] as $name) {
            DB::statement("ALTER TABLE feedbacks DROP CONSTRAINT IF EXISTS feedbacks_{$name}");
        }
        // Un dossier vocal sans commentaire ne peut pas revenir à NOT NULL : texte de remplacement conforme (10–3000).
        DB::statement("UPDATE feedbacks SET comment = 'Message vocal (supprimé).' WHERE comment IS NULL");
        DB::statement('ALTER TABLE feedbacks ALTER COLUMN comment SET NOT NULL');

        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropColumn(['voice_disk', 'voice_path', 'voice_mime', 'voice_size_bytes', 'voice_duration_seconds']);
        });
    }
};
