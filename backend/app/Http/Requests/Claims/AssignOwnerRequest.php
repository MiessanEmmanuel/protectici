<?php

namespace App\Http\Requests\Claims;

use App\Models\EstablishmentClaim;
use Illuminate\Foundation\Http\FormRequest;

/** Attribution d'une fiche à un compte existant par son e-mail (contrat §10.3). */
class AssignOwnerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('review', EstablishmentClaim::class);
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['email' => ['required', 'string', 'email', 'max:255']];
    }
}
