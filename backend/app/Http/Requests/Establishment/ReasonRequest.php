<?php

namespace App\Http\Requests\Establishment;

use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

/** Motif saisi par l'administration (rejet : ≥ 10 caractères ; suspension : ≥ 3). */
class ReasonRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('admin-area');
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => PlainText::multiline($this->input('reason'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $min = $this->routeIs('admin.establishments.suspend') ? 3 : 10;

        return ['reason' => ['required', 'string', "min:{$min}", 'max:1000']];
    }
}
