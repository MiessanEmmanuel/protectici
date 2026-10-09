<?php

namespace App\Services\Media;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * Validation par CONTENU et réencodage des images envoyées (security.md §16) :
 *  - le type réel est lu par finfo (jamais l'extension ni le Content-Type déclaré) ;
 *  - l'image est décodée puis réencodée par GD : EXIF/GPS, profils, commentaires et charges cachées disparaissent ;
 *  - dimensions bornées (côté maximal + nombre de pixels maximal avant décodage : anti décompression-bombe) ;
 *  - tout fichier qui n'est pas une image décodable est rejeté (PDF, exécutable déguisé, SVG, GIF animé…).
 */
class ImageProcessor
{
    public const FORMAT_WEBP = 'webp';

    public const FORMAT_JPEG = 'jpeg';

    public const FORMAT_PNG = 'png';

    /** @var array<string, string> mime détecté => format de sortie « fidèle » */
    private const SAME_FORMAT = ['image/jpeg' => self::FORMAT_JPEG, 'image/png' => self::FORMAT_PNG];

    /**
     * @param  list<string>  $allowedMimes  types réels acceptés
     * @param  self::FORMAT_*|'same'  $output  format de sortie ('same' = JPEG→JPEG, PNG→PNG)
     * @return array{binary: string, mime: string, extension: string, width: int, height: int}
     */
    public function process(UploadedFile $file, array $allowedMimes, int $maxEdge, string $output = self::FORMAT_WEBP, string $field = 'file'): array
    {
        $path = $file->getRealPath();
        if (! $file->isValid() || $path === false) {
            $this->fail($field, 'Le fichier n\'a pas pu être envoyé correctement.');
        }

        $bytes = file_get_contents($path);
        if ($bytes === false || $bytes === '') {
            $this->fail($field, 'Le fichier est vide.');
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->buffer($bytes);
        if (! is_string($mime) || ! in_array($mime, $allowedMimes, true)) {
            $this->fail($field, 'Le type de fichier n\'est pas autorisé.');
        }

        $info = @getimagesizefromstring($bytes);
        if ($info === false || $info[0] < 1 || $info[1] < 1) {
            $this->fail($field, 'Le fichier n\'est pas une image valide.');
        }

        [$width, $height] = $info;
        if ($width * $height > (int) config('establishments.media.max_pixels', 16_000_000)) {
            $this->fail($field, 'L\'image est trop grande (16 mégapixels maximum).');
        }

        $source = @imagecreatefromstring($bytes);
        if (! $source instanceof GdImage) {
            $this->fail($field, 'Le fichier n\'est pas une image valide.');
        }

        try {
            if (! imageistruecolor($source)) {
                imagepalettetotruecolor($source);
            }

            if ($mime === 'image/jpeg') {
                $source = $this->applyOrientation($source, $path);
            }

            $target = $this->resample($source, $maxEdge);
        } finally {
            unset($source);
        }

        $format = $output === 'same' ? (self::SAME_FORMAT[$mime] ?? self::FORMAT_WEBP) : $output;
        $binary = $this->encode($target, $format);
        $outWidth = imagesx($target);
        $outHeight = imagesy($target);
        unset($target);

        if ($binary === '') {
            $this->fail($field, 'L\'image n\'a pas pu être traitée.');
        }

        return [
            'binary' => $binary,
            'mime' => match ($format) {
                self::FORMAT_JPEG => 'image/jpeg',
                self::FORMAT_PNG => 'image/png',
                default => 'image/webp',
            },
            'extension' => match ($format) {
                self::FORMAT_JPEG => 'jpg',
                self::FORMAT_PNG => 'png',
                default => 'webp',
            },
            'width' => $outWidth,
            'height' => $outHeight,
        ];
    }

    /** Redresse selon l'orientation EXIF (JPEG) : l'EXIF lui-même n'est pas conservé. */
    private function applyOrientation(GdImage $image, string $path): GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data($path);
        $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;

        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => false,
        };

        if ($rotated instanceof GdImage) {
            return $rotated;
        }

        return $image;
    }

    /** Copie redimensionnée (côté max borné) avec canal alpha conservé. */
    private function resample(GdImage $source, int $maxEdge): GdImage
    {
        $width = imagesx($source);
        $height = imagesy($source);
        $scale = min(1.0, $maxEdge / max($width, $height));
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));

        $target = imagecreatetruecolor($newWidth, $newHeight);
        if (! $target instanceof GdImage) {
            $this->fail('file', 'L\'image n\'a pas pu être traitée.');
        }

        imagealphablending($target, false);
        imagesavealpha($target, true);
        $transparent = imagecolorallocatealpha($target, 255, 255, 255, 127);
        imagefill($target, 0, 0, (int) $transparent);
        imagecopyresampled($target, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        return $target;
    }

    private function encode(GdImage $image, string $format): string
    {
        ob_start();
        try {
            match ($format) {
                self::FORMAT_JPEG => $this->encodeJpeg($image),
                self::FORMAT_PNG => imagepng($image, null, 6),
                default => imagewebp($image, null, (int) config('establishments.media.webp_quality', 82)),
            };
        } finally {
            $binary = (string) ob_get_clean();
        }

        return $binary;
    }

    /** JPEG n'a pas de transparence : aplatit sur fond blanc. */
    private function encodeJpeg(GdImage $image): void
    {
        $flat = imagecreatetruecolor(imagesx($image), imagesy($image));
        if ($flat instanceof GdImage) {
            imagefill($flat, 0, 0, (int) imagecolorallocate($flat, 255, 255, 255));
            imagealphablending($flat, true);
            imagecopy($flat, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
            imagejpeg($flat, null, 88);
        }
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }
}
