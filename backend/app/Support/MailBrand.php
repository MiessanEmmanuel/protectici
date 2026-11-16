<?php

namespace App\Support;

use App\Services\Content\SiteSettings;
use Throwable;

/** Identité des e-mails (gabarits resources/views/vendor/mail) : lien du site, logo et coordonnées publiques. */
class MailBrand
{
    /** Valeurs publiques de l'ancien site, utilisées si les paramètres du site sont absents ou illisibles. */
    private const DEFAULTS = [
        'contact.phone' => '+2250709445111',
        'contact.email' => 'info@protectici.ci',
        'site.address' => 'Abidjan Plateau, immeuble Eden',
    ];

    public static function siteUrl(): string
    {
        return rtrim((string) config('auth.frontend_url'), '/');
    }

    /** Icône servie par le front (exclue du proxy d'authentification, donc lisible par les messageries). */
    public static function logoUrl(): string
    {
        return self::siteUrl().'/elephant-icon-192.png';
    }

    /** @return array{phone: string, phone_display: string, email: string, address: string} */
    public static function contact(): array
    {
        try {
            $settings = app(SiteSettings::class)->publicMap();
        } catch (Throwable) {
            $settings = [];
        }

        $value = fn (string $key): string => is_string($settings[$key] ?? null) && trim($settings[$key]) !== '' ? trim($settings[$key]) : self::DEFAULTS[$key];
        $phone = $value('contact.phone');

        return [
            'phone' => $phone,
            'phone_display' => self::formatPhone($phone),
            'email' => $value('contact.email'),
            'address' => $value('site.address'),
        ];
    }

    /** +2250709445111 → +225 07 09 44 51 11 ; tout autre format est rendu tel quel. */
    private static function formatPhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if (preg_match('/^225(\d{10})$/', $digits, $m) === 1) {
            return '+225 '.implode(' ', str_split($m[1], 2));
        }

        return $phone;
    }
}
