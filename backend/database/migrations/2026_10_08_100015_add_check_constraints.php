<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const STATUS_LIST = "'draft','pending','approved','rejected','suspended'";

    /** @return array<string, array<string, string>> table => [nom => expression] */
    private function constraints(): array
    {
        $geo = fn (): array => [
            'lat_range_chk' => 'latitude IS NULL OR latitude BETWEEN -90 AND 90',
            'lng_range_chk' => 'longitude IS NULL OR longitude BETWEEN -180 AND 180',
            'lat_lng_pair_chk' => '(latitude IS NULL) = (longitude IS NULL)',
        ];

        return [
            'users' => [
                'role_chk' => "role IN ('user','provider','editor','admin')",
            ],
            'cities' => $geo(),
            'districts' => $geo() + [
                'parent_not_self_chk' => 'parent_id IS NULL OR parent_id <> id',
            ],
            'media' => [
                'collection_chk' => "collection IN ('logo','cover','gallery','avatar','content')",
                'mime_type_chk' => "mime_type IN ('image/jpeg','image/png','image/webp','image/avif')",
                'size_bytes_chk' => 'size_bytes > 0',
            ],
            'providers' => $geo() + [
                'price_from_chk' => 'price_from IS NULL OR price_from >= 0',
                'legal_form_chk' => "legal_form IS NULL OR legal_form IN ('sarl','sa','sas','suarl','ei','association','other')",
                'share_capital_chk' => 'share_capital IS NULL OR share_capital >= 0',
                'submitter_role_chk' => "submitter_role IS NULL OR submitter_role IN ('manager','employee','other')",
                'status_chk' => 'status IN ('.self::STATUS_LIST.')',
                'rejection_reason_chk' => "status <> 'rejected' OR rejection_reason IS NOT NULL",
                'publish_requires_approved_chk' => "NOT is_visible OR status = 'approved'",
                'views_count_chk' => 'views_count >= 0',
                'rating_avg_chk' => 'rating_avg BETWEEN 0 AND 5',
                'rating_count_chk' => 'rating_count >= 0',
            ],
            'provider_executives' => [
                'position_chk' => "position IN ('general_manager','commercial_manager','operations_manager','other')",
            ],
            'provider_documents' => [
                'type_chk' => "type IN ('approval_certificate','rccm_extract','id_document','other')",
                'mime_type_chk' => "mime_type IN ('application/pdf','image/jpeg','image/png')",
                'size_bytes_chk' => 'size_bytes > 0',
            ],
            'provider_change_requests' => [
                'status_chk' => "status IN ('pending','approved','rejected')",
            ],
            'state_forces' => $geo() + [
                'status_chk' => 'status IN ('.self::STATUS_LIST.')',
                'rejection_reason_chk' => "status <> 'rejected' OR rejection_reason IS NOT NULL",
                'publish_requires_approved_chk' => "NOT is_visible OR status = 'approved'",
                'views_count_chk' => 'views_count >= 0',
            ],
            'reviews' => [
                'rating_chk' => 'rating BETWEEN 1 AND 5',
                'body_length_chk' => 'char_length(body) BETWEEN 10 AND 3000',
                'status_chk' => "status IN ('pending','approved','rejected')",
                'publish_requires_approved_chk' => "NOT is_visible OR status = 'approved'",
                'provider_reply_chk' => '(provider_reply IS NULL) = (provider_replied_at IS NULL)',
            ],
            'review_reports' => [
                'reason_chk' => "reason IN ('spam','offensive','false_info','other')",
                'status_chk' => "status IN ('open','accepted','dismissed')",
            ],
            'feedbacks' => [
                'civility_chk' => "civility IS NULL OR civility IN ('M.','Mme','Mlle')",
                'action_type_chk' => "action_type IN ('encouragement','question','complaint','suggestion')",
                'target_type_chk' => "target_type IN ('employee','product','service')",
                'status_chk' => "status IN ('new','in_progress','forwarded','resolved','closed')",
                'comment_length_chk' => 'char_length(comment) BETWEEN 10 AND 3000',
                'topic_required_chk' => "target_type = 'product' OR topic_id IS NOT NULL",
                'service_required_chk' => "target_type <> 'service' OR service_type_id IS NOT NULL",
            ],
            'quote_requests' => [
                'status_chk' => "status IN ('new','sent','answered','closed','cancelled')",
            ],
            'quote_request_recipients' => [
                'status_chk' => "status IN ('sent','viewed','replied','declined')",
                'quoted_amount_chk' => 'quoted_amount IS NULL OR quoted_amount >= 0',
            ],
            'contact_messages' => [
                'status_chk' => "status IN ('new','read','answered','archived')",
                'message_length_chk' => 'char_length(message) BETWEEN 10 AND 5000',
            ],
            'posts' => [
                'status_chk' => "status IN ('draft','scheduled','published','archived')",
                'published_at_chk' => "status NOT IN ('scheduled','published') OR published_at IS NOT NULL",
                'views_count_chk' => 'views_count >= 0',
            ],
            'post_comments' => [
                'status_chk' => "status IN ('pending','approved','rejected','spam')",
                'body_length_chk' => 'char_length(body) BETWEEN 2 AND 2000',
                'publish_requires_approved_chk' => "NOT is_visible OR status = 'approved'",
            ],
            'partners' => [
                'type_chk' => "type IN ('partner','client')",
            ],
            'newsletter_subscribers' => [
                'status_chk' => "status IN ('pending','confirmed','unsubscribed','bounced')",
            ],
            'consent_logs' => [
                'purpose_chk' => "purpose IN ('privacy_policy','registration','newsletter','feedback','quote','contact')",
            ],
        ];
    }

    public function up(): void
    {
        foreach ($this->constraints() as $table => $checks) {
            foreach ($checks as $name => $expression) {
                DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_{$name} CHECK ({$expression})");
            }
        }
    }

    public function down(): void
    {
        foreach (array_reverse($this->constraints(), true) as $table => $checks) {
            foreach (array_reverse(array_keys($checks)) as $name) {
                DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$table}_{$name}");
            }
        }
    }
};
