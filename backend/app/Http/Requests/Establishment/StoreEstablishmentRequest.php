<?php

namespace App\Http\Requests\Establishment;

use App\Enums\EstablishmentType;
use App\Rules\ValidTurnstileToken;
use Illuminate\Validation\Rule;

class StoreEstablishmentRequest extends EstablishmentRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('register-establishment');
    }

    public function establishmentType(): ?EstablishmentType
    {
        return is_string($this->input('type')) ? EstablishmentType::tryFrom($this->input('type')) : null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(EstablishmentType::values())],
            'idempotency_key' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'consent' => ['required', 'accepted'],
            'turnstile_token' => ValidTurnstileToken::rules(),
        ] + $this->schemaRules(false);
    }

    /** Clé d'idempotence (en-tête), validée séparément : 8 à 64 caractères sûrs. */
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
}
