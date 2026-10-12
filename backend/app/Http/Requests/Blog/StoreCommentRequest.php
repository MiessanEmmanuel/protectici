<?php

namespace App\Http\Requests\Blog;

use App\Rules\ValidTurnstileToken;
use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

/** Commentaire d'article (contrat §9.1) : texte brut, antispam §8.0 (Turnstile, champ piège, Idempotency-Key). */
class StoreCommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body'))) {
            $this->merge(['body' => PlainText::multiline($this->input('body'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:2', 'max:2000'],
            'parent_id' => ['nullable', 'integer', 'min:1'],
            'idempotency_key' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'company_website' => ['nullable', 'string', 'max:255'],
            'turnstile_token' => ValidTurnstileToken::rules(),
        ];
    }

    /** @return array<string, mixed> */
    public function validationData(): array
    {
        return $this->all() + ['idempotency_key' => $this->idempotencyKey()];
    }

    public function idempotencyKey(): ?string
    {
        $key = $this->header('Idempotency-Key');

        return is_string($key) && $key !== '' ? $key : null;
    }

    public function isBot(): bool
    {
        $value = $this->input('company_website');

        return is_string($value) ? trim($value) !== '' : $value !== null && $value !== [];
    }

    /** @return array{body: string, parent_id?: int|null} */
    public function commentData(): array
    {
        $v = $this->validated();

        return ['body' => $v['body'], 'parent_id' => $v['parent_id'] ?? null];
    }
}
