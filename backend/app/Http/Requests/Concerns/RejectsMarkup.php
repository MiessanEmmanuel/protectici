<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Support\Arr;
use Illuminate\Validation\Validator;

/**
 * Rejet des balises HTML dans les champs texte saisis par des tiers (security.md §1 : rejeter plutôt que nettoyer).
 *
 * Les valeurs sont contrôlées AVANT le nettoyage de prepareForValidation (PlainText reste le filet de sécurité) :
 * un champ du jeu de règles qui contient une balise (`<b>`, `</script>`, `<!-- -->`…) donne une erreur 422 en
 * français. Un « < » isolé (« 3 < 5 », « <3 ») reste accepté. Les mots de passe et jetons ne sont jamais examinés.
 */
trait RejectsMarkup
{
    /** @var array<string, mixed> */
    private array $rawInputBeforeCleaning = [];

    public function validateResolved(): void
    {
        $this->rawInputBeforeCleaning = $this->all();

        parent::validateResolved();
    }

    /** Vrai si la chaîne contient une balise HTML/XML (ouvrante, fermante, commentaire, doctype ou instruction). */
    public static function containsMarkup(string $value): bool
    {
        return preg_match('/<\s*(?:\/\s*)?[a-zA-Z!?][^<>]*>/u', $value) === 1;
    }

    protected function getValidatorInstance()
    {
        $hooked = $this->validator !== null;
        $validator = parent::getValidatorInstance();

        if (! $hooked) {
            $validator->after(fn (Validator $v) => $this->rejectMarkup($v));
        }

        return $validator;
    }

    private function rejectMarkup(Validator $validator): void
    {
        $patterns = [];
        foreach (array_keys($validator->getRules()) as $key) {
            if (preg_match('/password|token|turnstile|idempotency/i', (string) $key) === 1) {
                continue;
            }
            $patterns[] = '/^'.str_replace('\*', '[^.]+', preg_quote((string) $key, '/')).'$/';
        }

        foreach (Arr::dot($this->rawInputBeforeCleaning) as $key => $value) {
            if (! is_string($value) || ! self::containsMarkup($value) || $validator->errors()->has((string) $key)) {
                continue;
            }
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, (string) $key) === 1) {
                    $validator->errors()->add((string) $key, trans('validation.no_markup', [
                        'attribute' => $validator->getDisplayableAttribute((string) $key),
                    ]));
                    break;
                }
            }
        }
    }
}
