<?php

namespace App\Http\Resources;

use App\Models\Provider;
use Illuminate\Http\Request;

/** ProviderDetail (contrat §2) = ProviderSummary + détails publics. Dirigeants : uniquement is_visible. */
class ProviderDetailResource extends ProviderSummaryResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Provider $p */
        $p = $this->resource;
        $user = $request->user();

        return parent::toArray($request) + [
            'description' => $p->description ?? '',
            'address' => $p->address,
            'geo_description' => $p->geo_description,
            'plus_code' => $p->plus_code,
            'email' => $p->email,
            'website_url' => $p->website_url,
            'emergency_phone' => $p->emergency_phone,
            'socials' => [
                'facebook' => $p->facebook_url,
                'instagram' => $p->instagram_url,
                'twitter' => $p->twitter_url,
                'linkedin' => $p->linkedin_url,
                'whatsapp' => $p->whatsapp_number,
            ],
            'company_types' => OptionResource::collection($p->companyTypes),
            'legal' => [
                'legal_form' => $p->legal_form,
                'share_capital' => $p->share_capital,
                'rccm' => $p->rccm,
                'approval_number' => $p->approval_number,
                'corporate_purpose' => $p->corporate_purpose,
            ],
            'executives' => $p->executives->where('is_visible', true)->map(fn ($e) => [
                'full_name' => $e->full_name,
                'position' => $e->position,
                'position_label' => $e->position_label,
            ])->values(),
            'gallery' => $p->gallery->map(fn ($m) => ['url' => $m->url(), 'alt' => $m->alt_text ?? $p->name])->values(),
            'views_count' => $p->views_count,
            'is_favorite' => $user === null ? null : $user->favoriteProviders()->whereKey($p->getKey())->exists(),
        ];
    }
}
