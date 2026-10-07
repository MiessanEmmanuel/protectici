<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PUBLIC_PROVIDER = "is_visible AND status = 'approved' AND deleted_at IS NULL";

    /** @return array<string, string> nom d'index => instruction CREATE */
    private function indexes(): array
    {
        $pub = self::PUBLIC_PROVIDER;

        return [
            // Unicité (modele.md §4.1)
            'users_email_uq' => 'CREATE UNIQUE INDEX users_email_uq ON users (email) WHERE deleted_at IS NULL',
            'providers_rccm_uq' => 'CREATE UNIQUE INDEX providers_rccm_uq ON providers (rccm) WHERE rccm IS NOT NULL AND deleted_at IS NULL',
            'providers_approval_number_uq' => 'CREATE UNIQUE INDEX providers_approval_number_uq ON providers (approval_number) WHERE approval_number IS NOT NULL AND deleted_at IS NULL',
            'reviews_provider_user_uq' => 'CREATE UNIQUE INDEX reviews_provider_user_uq ON reviews (provider_id, user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL',

            // Spatial, plein texte, trigram (§4.2)
            'providers_location_gist' => 'CREATE INDEX providers_location_gist ON providers USING gist (location)',
            'state_forces_location_gist' => 'CREATE INDEX state_forces_location_gist ON state_forces USING gist (location)',
            'providers_search_gin' => 'CREATE INDEX providers_search_gin ON providers USING gin (search_vector)',
            'state_forces_search_gin' => 'CREATE INDEX state_forces_search_gin ON state_forces USING gin (search_vector)',
            'posts_search_gin' => 'CREATE INDEX posts_search_gin ON posts USING gin (search_vector)',
            'providers_name_trgm' => 'CREATE INDEX providers_name_trgm ON providers USING gin (name gin_trgm_ops)',
            'state_forces_name_trgm' => 'CREATE INDEX state_forces_name_trgm ON state_forces USING gin (name gin_trgm_ops)',

            // Listes publiques
            'providers_public_idx' => "CREATE INDEX providers_public_idx ON providers (city_id, district_id) WHERE {$pub}",
            'providers_featured_idx' => 'CREATE INDEX providers_featured_idx ON providers (is_featured, rating_avg DESC) WHERE is_visible AND deleted_at IS NULL',
            'providers_user_idx' => 'CREATE INDEX providers_user_idx ON providers (user_id)',
            'providers_status_idx' => 'CREATE INDEX providers_status_idx ON providers (status, created_at)',
            'state_forces_status_idx' => 'CREATE INDEX state_forces_status_idx ON state_forces (status, created_at)',
            'provider_service_type_rev_idx' => 'CREATE INDEX provider_service_type_rev_idx ON provider_service_type (service_type_id, provider_id)',
            'provider_company_type_rev_idx' => 'CREATE INDEX provider_company_type_rev_idx ON provider_company_type (company_type_id, provider_id)',
            'state_force_procedure_type_rev_idx' => 'CREATE INDEX state_force_procedure_type_rev_idx ON state_force_procedure_type (procedure_type_id, state_force_id)',
            'state_forces_type_idx' => 'CREATE INDEX state_forces_type_idx ON state_forces (force_type_id, city_id) WHERE is_visible AND deleted_at IS NULL',

            // Engagement
            'reviews_provider_public_idx' => 'CREATE INDEX reviews_provider_public_idx ON reviews (provider_id, created_at DESC) WHERE is_visible AND deleted_at IS NULL',
            'reviews_status_idx' => 'CREATE INDEX reviews_status_idx ON reviews (status, created_at)',
            'review_reports_status_idx' => 'CREATE INDEX review_reports_status_idx ON review_reports (status, created_at)',
            'favorites_provider_idx' => 'CREATE INDEX favorites_provider_idx ON favorites (provider_id)',

            // Éditorial
            'posts_public_idx' => "CREATE INDEX posts_public_idx ON posts (published_at DESC) WHERE is_visible AND status = 'published' AND deleted_at IS NULL",
            'posts_category_idx' => 'CREATE INDEX posts_category_idx ON posts (category_id, published_at DESC)',
            'posts_popular_idx' => "CREATE INDEX posts_popular_idx ON posts (views_count DESC) WHERE is_visible AND status = 'published'",
            'posts_flash_idx' => "CREATE INDEX posts_flash_idx ON posts (published_at DESC) WHERE is_flash AND is_visible AND status = 'published'",
            'post_comments_post_idx' => 'CREATE INDEX post_comments_post_idx ON post_comments (post_id, created_at) WHERE is_visible',

            // Relation client
            'feedbacks_status_idx' => 'CREATE INDEX feedbacks_status_idx ON feedbacks (status, created_at DESC)',
            'feedbacks_provider_idx' => 'CREATE INDEX feedbacks_provider_idx ON feedbacks (provider_id)',
            'feedbacks_email_idx' => 'CREATE INDEX feedbacks_email_idx ON feedbacks (email)',
            'quote_requests_status_idx' => 'CREATE INDEX quote_requests_status_idx ON quote_requests (status, created_at DESC)',
            'quote_request_recipients_provider_idx' => 'CREATE INDEX quote_request_recipients_provider_idx ON quote_request_recipients (provider_id, status)',

            // Technique
            'media_mediable_idx' => 'CREATE INDEX media_mediable_idx ON media (mediable_type, mediable_id, collection, sort_order)',
            'audit_logs_auditable_idx' => 'CREATE INDEX audit_logs_auditable_idx ON audit_logs (auditable_type, auditable_id, created_at DESC)',
            'audit_logs_user_idx' => 'CREATE INDEX audit_logs_user_idx ON audit_logs (user_id, created_at DESC)',
            'consent_logs_email_idx' => 'CREATE INDEX consent_logs_email_idx ON consent_logs (email, purpose)',
        ];
    }

    public function up(): void
    {
        foreach ($this->indexes() as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        foreach (array_reverse(array_keys($this->indexes())) as $name) {
            DB::statement("DROP INDEX IF EXISTS {$name}");
        }
    }
};
