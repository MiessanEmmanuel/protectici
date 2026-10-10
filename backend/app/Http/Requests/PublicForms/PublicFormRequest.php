<?php

namespace App\Http\Requests\PublicForms;

use App\Models\User;
use App\Rules\ValidTurnstileToken;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Base des formulaires publics (contrat §8.0) : ouverts aux visiteurs, compte facultatif, antispam commun.
 * - `turnstile_token` : vérifié côté serveur si TURNSTILE_ENABLED ;
 * - `company_website` : champ piège (honeypot), doit rester vide ;
 * - `consent` : obligatoire ;
 * - `Idempotency-Key` (en-tête) : 8 à 64 caractères sûrs.
 * Les champs inconnus sont ignorés (liste blanche : seul validated() est utilisé).
 */
abstract class PublicFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    protected function antispamRules(): array
    {
        return [
            'idempotency_key' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'company_website' => ['nullable', 'string', 'max:255'],
            'turnstile_token' => ValidTurnstileToken::rules(),
            'consent' => ['required', 'accepted'],
        ];
    }

    /** Champ piège rempli : le formulaire a été soumis par un robot. */
    public function isBot(): bool
    {
        $value = $this->input('company_website');

        return is_string($value) ? trim($value) !== '' : $value !== null && $value !== [];
    }

    public function idempotencyKey(): ?string
    {
        $key = $this->header('Idempotency-Key');

        return is_string($key) && $key !== '' ? $key : null;
    }

    /** @return array<string, mixed> */
    public function validationData(): array
    {
        return $this->all() + ['idempotency_key' => $this->idempotencyKey()];
    }

    /** Utilisateur connecté éventuel (session Sanctum), sans exiger l'authentification. */
    public function optionalUser(): ?User
    {
        $user = $this->user('sanctum');

        return $user instanceof User && $user->is_active ? $user : null;
    }

    /**
     * Données validées SANS les champs techniques (antispam, consentement) : base du hachage d'idempotence.
     *
     * @return array<string, mixed>
     */
    public function formData(): array
    {
        $data = $this->validated();
        unset($data['idempotency_key'], $data['company_website'], $data['turnstile_token'], $data['consent']);

        return $data;
    }
}
