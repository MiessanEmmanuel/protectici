<?php

namespace App\Http\Resources\Establishments;

use App\Enums\EstablishmentType;
use App\Models\Provider;
use App\Models\ProviderChangeRequest;
use App\Models\ProviderDocument;
use App\Models\StateForce;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * MyEstablishment (contrat §7.1) : vue du propriétaire, champs privés inclus, relations sous forme d'identifiants.
 * Les justificatifs n'ont jamais d'URL. Relations à charger : voir RELATIONS.
 */
class MyEstablishmentResource extends JsonResource
{
    /** @return list<string> */
    public static function relations(EstablishmentType $type): array
    {
        return $type === EstablishmentType::Provider
            ? ['companyTypes', 'serviceTypes', 'executives', 'media', 'documents', 'changeRequests']
            : ['procedureTypes', 'media', 'documents', 'changeRequests'];
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Provider|StateForce $e */
        $e = $this->resource;
        $type = EstablishmentType::tryFromModel($e);

        $base = [
            'type' => $type->value,
            'slug' => $e->slug,
            'name' => $e->name,
            'status' => $e->status,
            'rejection_reason' => $e->rejection_reason,
            'is_visible' => (bool) $e->is_visible,
            'is_verified' => $e instanceof Provider ? (bool) $e->is_verified : false,
            'submitted_at' => $this->iso($e->created_at),
            'reviewed_at' => $this->iso($e->reviewed_at),
            'pending_change_requests' => $e->changeRequests->where('status', 'pending')->count(),
            'description' => $e->description,
            'phone' => $e->phone,
            'phone_alt' => $e->phone_alt,
            'emergency_phone' => $e->emergency_phone,
            'email' => $e->email,
            'address' => $e->address,
            'city_id' => $e->city_id,
            'district_id' => $e->district_id,
            'geo_description' => $e->geo_description,
            'plus_code' => $e->plus_code,
            'lat' => $e->latitude === null ? null : (float) $e->latitude,
            'lng' => $e->longitude === null ? null : (float) $e->longitude,
        ];

        $specific = $e instanceof Provider ? [
            'website_url' => $e->website_url,
            'facebook_url' => $e->facebook_url,
            'instagram_url' => $e->instagram_url,
            'twitter_url' => $e->twitter_url,
            'linkedin_url' => $e->linkedin_url,
            'whatsapp_number' => $e->whatsapp_number,
            'price_from' => $e->price_from,
            'rccm' => $e->rccm,
            'legal_form' => $e->legal_form,
            'share_capital' => $e->share_capital,
            'corporate_purpose' => $e->corporate_purpose,
            'approval_number' => $e->approval_number,
            'approval_expires_at' => $e->approval_expires_at?->format('Y-m-d'),
            'submitter_role' => $e->submitter_role,
            'is_in_service' => (bool) $e->is_in_service,
            'company_type_ids' => $e->companyTypes->pluck('id')->values(),
            'service_type_ids' => $e->serviceTypes->pluck('id')->values(),
            'executives' => $e->executives->map(fn ($x) => [
                'id' => $x->id,
                'full_name' => $x->full_name,
                'position' => $x->position,
                'position_label' => $x->position_label,
                'is_visible' => (bool) $x->is_visible,
            ])->values(),
        ] : [
            'force_type_id' => $e->force_type_id,
            'opening_hours' => $e->opening_hours,
            'is_open_24h' => (bool) $e->is_open_24h,
            'procedure_type_ids' => $e->procedureTypes->pluck('id')->values(),
            'procedures' => $e->procedureTypes->map(fn ($p) => [
                'procedure_type_id' => $p->id,
                'notes' => data_get($p, 'pivot.notes'),
            ])->values(),
        ];

        return $base + $specific + [
            'media' => $e->media->map(fn ($m) => [
                'id' => $m->id,
                'collection' => $m->collection,
                'url' => $m->url(),
                'alt' => $m->alt_text ?? $e->name,
            ])->values(),
            'documents' => $e->documents->map(fn ($d) => self::document($d))->values(),
            'change_requests' => $e->changeRequests->sortByDesc('id')->map(fn ($c) => self::changeRequest($c))->values(),
        ] + $this->extra($e);
    }

    /** @return array<string, mixed> */
    protected function extra(Provider|StateForce $e): array
    {
        return [];
    }

    /** @return array<string, mixed> */
    public static function document(ProviderDocument $d): array
    {
        return [
            'id' => $d->id,
            'type' => $d->type,
            'original_name' => $d->original_name,
            'size_bytes' => $d->size_bytes,
            'uploaded_at' => self::isoStatic($d->created_at),
            'verified_at' => self::isoStatic($d->verified_at),
        ];
    }

    /** @return array<string, mixed> */
    public static function changeRequest(ProviderChangeRequest $c): array
    {
        return [
            'id' => $c->id,
            'changes' => $c->changes,
            'status' => $c->status,
            'rejection_reason' => $c->rejection_reason,
            'created_at' => self::isoStatic($c->created_at),
            'reviewed_at' => self::isoStatic($c->reviewed_at),
        ];
    }

    protected function iso(?\DateTimeInterface $date): ?string
    {
        return self::isoStatic($date);
    }

    public static function isoStatic(?\DateTimeInterface $date): ?string
    {
        return $date === null ? null : Carbon::instance($date)->utc()->format('Y-m-d\TH:i:s\Z');
    }
}
