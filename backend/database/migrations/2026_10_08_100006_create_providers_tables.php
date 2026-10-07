<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('providers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->string('name', 200);
            $table->string('slug', 220)->unique('providers_slug_uq');
            $table->text('description')->nullable();
            $table->integer('price_from')->nullable();
            $table->string('phone', 30);
            $table->string('phone_alt', 30)->nullable();
            $table->string('emergency_phone', 30)->nullable();
            $table->rawColumn('email', 'citext')->nullable();
            $table->string('website_url', 255)->nullable();
            $table->string('facebook_url', 255)->nullable();
            $table->string('instagram_url', 255)->nullable();
            $table->string('twitter_url', 255)->nullable();
            $table->string('linkedin_url', 255)->nullable();
            $table->string('whatsapp_number', 30)->nullable();
            $table->string('address', 255)->nullable();
            $table->foreignId('city_id')->index()->constrained('cities')->restrictOnDelete();
            $table->foreignId('district_id')->nullable()->index()->constrained('districts')->nullOnDelete();
            $table->text('geo_description')->nullable();
            $table->string('plus_code', 20)->nullable();
            Columns::coordinates($table);
            $table->string('rccm', 50)->nullable();
            $table->string('legal_form', 30)->nullable();
            $table->bigInteger('share_capital')->nullable();
            $table->text('corporate_purpose')->nullable();
            $table->string('approval_number', 50)->nullable();
            $table->date('approval_expires_at')->nullable();
            $table->string('submitter_role', 20)->nullable();
            $table->boolean('is_in_service')->default(true);
            $table->string('status', 20)->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->timestampTz('verified_at')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->integer('views_count')->default(0);
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->integer('rating_count')->default(0);
            $table->rawColumn('search_vector', 'tsvector')->nullable();
            Columns::visible($table);
            Columns::tracking($table, true);
        });

        Schema::create('provider_company_type', function (Blueprint $table) {
            $table->foreignId('provider_id')->constrained('providers')->cascadeOnDelete();
            $table->foreignId('company_type_id')->constrained('company_types')->restrictOnDelete();
            $table->primary(['provider_id', 'company_type_id']);
        });

        Schema::create('provider_service_type', function (Blueprint $table) {
            $table->foreignId('provider_id')->constrained('providers')->cascadeOnDelete();
            $table->foreignId('service_type_id')->constrained('service_types')->restrictOnDelete();
            $table->primary(['provider_id', 'service_type_id']);
        });

        Schema::create('provider_executives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->index()->constrained('providers')->cascadeOnDelete();
            $table->string('full_name', 150);
            $table->string('position', 30);
            $table->string('position_label', 100)->nullable();
            $table->smallInteger('sort_order')->default(0);
            Columns::visible($table);
            Columns::tracking($table);
        });

        Schema::create('provider_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->index()->constrained('providers')->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('disk', 20)->default('private');
            $table->string('path', 500);
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->integer('size_bytes');
            $table->date('expires_at')->nullable();
            $table->timestampTz('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->index()->constrained('users')->nullOnDelete();
            Columns::tracking($table, true);
        });

        Schema::create('provider_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->index()->constrained('providers')->cascadeOnDelete();
            $table->foreignId('requested_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->jsonb('changes');
            $table->string('status', 20)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            Columns::tracking($table);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('provider_change_requests');
        Schema::dropIfExists('provider_documents');
        Schema::dropIfExists('provider_executives');
        Schema::dropIfExists('provider_service_type');
        Schema::dropIfExists('provider_company_type');
        Schema::dropIfExists('providers');
    }
};
