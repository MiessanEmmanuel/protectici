<?php

namespace App\Support;

/**
 * Texte saisi par un tiers inséré dans un e-mail (rendu Markdown par Laravel) : on neutralise la syntaxe Markdown
 * (liens, images, titres, HTML) pour qu'aucun lien ou formatage ne puisse être injecté (hameçonnage).
 */
final class MailText
{
    public static function plain(string $text): string
    {
        $text = PlainText::multiline($text);
        $escaped = preg_replace('/([\\\\`*_{}\[\]()<>#+\-!|~>])/u', '\\\\$1', (string) $text);

        return (string) $escaped;
    }

    /** @return list<string> lignes non vides, échappées */
    public static function lines(string $text): array
    {
        $out = [];
        foreach (explode("\n", $text) as $line) {
            $line = trim($line);
            if ($line !== '') {
                $out[] = self::plain($line);
            }
        }

        return $out;
    }
}
