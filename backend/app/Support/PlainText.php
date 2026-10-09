<?php

namespace App\Support;

/**
 * Texte brut pour les contenus saisis par des tiers (security.md §14) : balises retirées, caractères de
 * contrôle supprimés (injection d'en-têtes e-mail, journaux), espaces normalisés.
 */
final class PlainText
{
    public static function single(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $text = self::clean($value);
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text);
    }

    /** Texte multi-lignes (descriptions) : sauts de ligne conservés, 2 maximum d'affilée. */
    public static function multiline(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $text = str_replace(["\r\n", "\r"], "\n", self::clean($value));
        $text = preg_replace("/[ \t]+/u", ' ', $text) ?? $text;
        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

        return trim($text);
    }

    private static function clean(string $value): string
    {
        $text = strip_tags($value);

        // Supprime les caractères de contrôle (sauf \n et \t), le NUL et les marques de direction Unicode (U+202A..U+202E, U+2066..U+2069).
        return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $text) ?? $text;
    }
}
