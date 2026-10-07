<?php

namespace App\Rules;

use App\Services\Turnstile\TurnstileVerifier;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Request;

/** Vérification serveur du jeton Cloudflare Turnstile (security.md §15). */
final class ValidTurnstileToken implements ValidationRule
{
    public function __construct(private readonly TurnstileVerifier $verifier) {}

    /**
     * Règles du champ `turnstile_token` : requis uniquement si Turnstile est activé.
     *
     * @return array<int, mixed>
     */
    public static function rules(): array
    {
        $verifier = app(TurnstileVerifier::class);

        if (! $verifier->enabled()) {
            return ['nullable', 'string', 'max:2048'];
        }

        return ['required', 'string', 'max:2048', new self($verifier)];
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! $this->verifier->verify($value, Request::ip())) {
            $fail('La vérification anti-robot a échoué. Veuillez réessayer.');
        }
    }
}
