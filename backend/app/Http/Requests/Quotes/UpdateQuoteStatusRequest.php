<?php

namespace App\Http\Requests\Quotes;

use App\Models\QuoteRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateQuoteStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['status' => ['required', 'string', Rule::in(QuoteRequest::STATUSES)]];
    }
}
