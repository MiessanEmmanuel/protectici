<?php

namespace App\Http\Requests\Content;

use Illuminate\Foundation\Http\FormRequest;

class SavePageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:2', 'max:200'],
            'body' => ['required', 'string', 'max:200000'],
            'seo_title' => ['nullable', 'string', 'max:160'],
            'seo_description' => ['nullable', 'string', 'max:300'],
            'is_visible' => ['required', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['title' => 'titre', 'body' => 'contenu', 'seo_title' => 'titre SEO', 'seo_description' => 'description SEO', 'is_visible' => 'visibilité'];
    }
}
