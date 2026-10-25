<?php

namespace App\Services\Feedback;

use App\Models\Feedback;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Message vocal « Dis-moi tout » (api-contract §8.2 bis, security.md §16) :
 *  - type réel détecté par signature (jamais l'extension ni le Content-Type déclaré), liste blanche WebM / MP4 / Ogg ;
 *  - fichier conservé tel quel (pas de réencodage), sur un disque PRIVÉ, nom ULID, jamais le nom d'origine ;
 *  - jamais servi publiquement (lecture par l'administration uniquement, flux serveur).
 */
class VoiceNoteStore
{
    public const INVALID = 'Le message vocal doit être un enregistrement audio (WebM, MP4 ou Ogg) de 5 Mo maximum.';

    /** Type MIME normalisé => extension de stockage. */
    public const EXTENSIONS = ['audio/webm' => 'webm', 'audio/mp4' => 'm4a', 'audio/ogg' => 'ogg'];

    /**
     * Vérifie le fichier et renvoie son type normalisé. Lève une erreur de validation sur `voice` sinon.
     *
     * @return array{mime: string, extension: string, size: int}
     */
    public function inspect(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        $size = $path === false ? false : filesize($path);
        $maxBytes = (int) config('feedback.voice_max_kb', 5120) * 1024;
        if (! $file->isValid() || $path === false || $size === false || $size < 12 || $size > $maxBytes) {
            throw $this->invalid();
        }

        $handle = fopen($path, 'rb');
        $head = $handle === false ? false : fread($handle, 16);
        if (is_resource($handle)) {
            fclose($handle);
        }
        if (! is_string($head) || strlen($head) < 12) {
            throw $this->invalid();
        }

        $mime = $this->detect($head);
        if ($mime === null) {
            throw $this->invalid();
        }

        return ['mime' => $mime, 'extension' => self::EXTENSIONS[$mime], 'size' => $size];
    }

    /**
     * Écrit le fichier sur le disque privé et renvoie les colonnes voice_* à enregistrer (sans la durée).
     *
     * @param  array{mime: string, extension: string, size: int}  $inspected
     * @return array{voice_disk: string, voice_path: string, voice_mime: string, voice_size_bytes: int}
     */
    public function store(Feedback $feedback, UploadedFile $file, array $inspected): array
    {
        $disk = (string) config('feedback.voice_disk');
        $name = Str::lower((string) Str::ulid()).'.'.$inspected['extension'];
        $path = Storage::disk($disk)->putFileAs('feedback-voice/'.$feedback->id, $file, $name, ['visibility' => 'private']);

        if (! is_string($path) || $path === '') {
            throw new \RuntimeException('Écriture du message vocal impossible.');
        }

        return [
            'voice_disk' => $disk,
            'voice_path' => $path,
            'voice_mime' => $inspected['mime'],
            'voice_size_bytes' => $inspected['size'],
        ];
    }

    /**
     * Supprime un fichier vocal. Vrai si le fichier n'existe plus (déjà absent compris), faux en cas d'échec
     * (journalisé sans chemin ni donnée personnelle) : l'appelant garde alors la référence pour réessayer.
     */
    public function delete(?string $disk, ?string $path): bool
    {
        if ($disk === null || $path === null || $path === '') {
            return true;
        }

        try {
            $storage = Storage::disk($disk);

            return $storage->delete($path) || ! $storage->exists($path);
        } catch (\Throwable $e) {
            Log::warning('feedback_voice_delete_failed', ['exception' => $e::class]);

            return false;
        }
    }

    /** Signature du conteneur => type normalisé, ou null si hors liste blanche. */
    private function detect(string $head): ?string
    {
        return match (true) {
            str_starts_with($head, "\x1A\x45\xDF\xA3") => 'audio/webm', // EBML (WebM / Matroska)
            substr($head, 4, 4) === 'ftyp' => 'audio/mp4',              // ISO BMFF (Safari / iOS : finfo dit video/mp4 ou audio/x-m4a)
            str_starts_with($head, 'OggS') => 'audio/ogg',
            default => null,
        };
    }

    private function invalid(): ValidationException
    {
        return ValidationException::withMessages(['voice' => [self::INVALID]]);
    }
}
