<?php

namespace App\Http\Requests\Reviews;

use App\Exceptions\ApiHttpException;
use App\Http\Requests\Concerns\RejectsMarkup;
use App\Models\Review;
use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Signalement d'un avis. */
class ReportReviewRequest extends FormRequest
{
    use RejectsMarkup;

    private ?Review $review = null;

    /**
     * Autorisation AVANT la validation du corps (R26) : avis inexistant ou non publié → 404, propre avis → 403,
     * jamais un 422 qui renseignerait sur l'existence de l'avis.
     */
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null) {
            return false;
        }

        $this->review = Review::query()->published()->findOrFail((int) $this->route('id'));
        if ($this->review->user_id === $user->getAuthIdentifier()) {
            throw new ApiHttpException(403, 'Vous ne pouvez pas signaler votre propre avis.');
        }

        return true;
    }

    /** Avis visé, résolu et autorisé par authorize(). */
    public function review(): Review
    {
        return $this->review ?? Review::query()->published()->findOrFail((int) $this->route('id'));
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('details'))) {
            $details = PlainText::multiline($this->input('details'));
            $this->merge(['details' => $details === '' ? null : $details]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', Rule::in(['spam', 'offensive', 'false_info', 'other'])],
            'details' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
