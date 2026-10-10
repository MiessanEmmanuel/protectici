<?php

namespace App\Http\Requests\Reviews;

use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

/** Création d'un avis (contrat §8.1). Liste blanche : rating, title, body ; le reste est ignoré. */
class StoreReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $clean = [];
        if (is_string($this->input('title'))) {
            $title = PlainText::single($this->input('title'));
            $clean['title'] = $title === '' ? null : $title;
        }
        if (is_string($this->input('body'))) {
            $clean['body'] = PlainText::multiline($this->input('body'));
        }
        $this->merge($clean);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'rating' => ['required', 'integer', 'between:1,5'],
            'title' => ['nullable', 'string', 'max:150'],
            'body' => ['required', 'string', 'min:10', 'max:3000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'rating.required' => 'Veuillez attribuer une note de 1 à 5.',
            'rating.between' => 'La note doit être comprise entre 1 et 5.',
            'body.required' => 'Veuillez rédiger votre avis.',
            'body.min' => 'Votre avis doit contenir au moins 10 caractères.',
            'body.max' => 'Votre avis ne peut pas dépasser 3000 caractères.',
        ];
    }
}
