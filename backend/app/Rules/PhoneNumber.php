<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Téléphone au format E.164 (security.md §14). La normalisation (espaces, points, tirets,
 * préfixe 00, numéro ivoirien local à 10 chiffres → +225) se fait AVANT validation via normalize().
 */
final class PhoneNumber implements ValidationRule
{
    private const E164 = '/^\+[1-9]\d{7,14}$/';

    public static function normalize(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $phone = preg_replace('/[\s.\-()]/u', '', trim($value)) ?? '';
        if ($phone === '') {
            return null;
        }

        if (str_starts_with($phone, '00')) {
            $phone = '+'.substr($phone, 2);
        }

        // Numéro ivoirien local (10 chiffres depuis 2021).
        if (preg_match('/^0\d{9}$/', $phone) === 1) {
            $phone = '+225'.$phone;
        }

        return $phone;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || preg_match(self::E164, $value) !== 1) {
            $fail('Le numéro de téléphone est invalide (format attendu : +225XXXXXXXXXX).');
        }
    }
}
