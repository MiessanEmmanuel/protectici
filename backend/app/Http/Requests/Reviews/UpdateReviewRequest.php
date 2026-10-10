<?php

namespace App\Http\Requests\Reviews;

use Illuminate\Validation\Validator;

/** Modification d'un avis par son auteur : au moins un champ parmi rating, title, body. */
class UpdateReviewRequest extends StoreReviewRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'rating' => ['sometimes', 'required', 'integer', 'between:1,5'],
            'title' => ['sometimes', 'nullable', 'string', 'max:150'],
            'body' => ['sometimes', 'required', 'string', 'min:10', 'max:3000'],
        ];
    }

    /** @return array<int, \Closure> */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->hasAny(['rating', 'title', 'body'])) {
                    $validator->errors()->add('rating', 'Veuillez modifier au moins un champ (note, titre ou avis).');
                }
            },
        ];
    }
}
