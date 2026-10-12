<?php

namespace App\Http\Requests\Content;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Création (POST) et modification partielle (PATCH) d'un article. Liste blanche : seul validated() est utilisé,
 * jamais author_id, slug, views_count ni is_visible (calculés par le serveur).
 */
class SavePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'min:3', 'max:200'],
            'category_id' => [$required, 'integer', Rule::exists('post_categories', 'id')],
            'excerpt' => ['sometimes', 'nullable', 'string', 'max:500'],
            'body' => [$required, 'string', 'max:200000'],
            'status' => ['sometimes', 'string', Rule::in(['draft', 'scheduled', 'published', 'archived'])],
            'published_at' => ['sometimes', 'nullable', 'date', Rule::requiredIf(fn () => $this->input('status') === 'scheduled' && $this->isMethod('POST'))],
            'is_featured' => ['sometimes', 'boolean'],
            'is_flash' => ['sometimes', 'boolean'],
            'seo_title' => ['sometimes', 'nullable', 'string', 'max:160'],
            'seo_description' => ['sometimes', 'nullable', 'string', 'max:300'],
            'cover_media_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return [
            'title' => 'titre', 'category_id' => 'catégorie', 'excerpt' => 'résumé', 'body' => 'contenu',
            'status' => 'statut', 'published_at' => 'date de publication', 'seo_title' => 'titre SEO',
            'seo_description' => 'description SEO', 'cover_media_id' => 'image de couverture',
        ];
    }
}
