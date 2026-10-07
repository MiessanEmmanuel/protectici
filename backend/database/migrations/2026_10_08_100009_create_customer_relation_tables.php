<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Séquences de références + fonction (modele.md §5.2) : avant les tables qui les utilisent.
        DB::statement('CREATE SEQUENCE IF NOT EXISTS feedback_ref_seq');
        DB::statement('CREATE SEQUENCE IF NOT EXISTS quote_ref_seq');
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_next_reference(prefix text, seq regclass)
            RETURNS text
            LANGUAGE sql
            VOLATILE
            AS $$
                SELECT prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval(seq)::text, 6, '0')
            $$
        SQL);

        Schema::create('feedbacks', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->default(DB::raw("fn_next_reference('DMT', 'feedback_ref_seq')"));
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->string('civility', 5)->nullable();
            $table->string('last_name', 100);
            $table->string('first_name', 100);
            $table->rawColumn('email', 'citext')->nullable();
            $table->string('phone', 30)->nullable();
            $table->foreignId('provider_id')->nullable()->index()->constrained('providers')->nullOnDelete();
            $table->string('action_type', 20);
            $table->string('target_type', 20);
            $table->foreignId('service_type_id')->nullable()->index()->constrained('service_types')->nullOnDelete();
            $table->foreignId('topic_id')->nullable()->index()->constrained('feedback_topics')->nullOnDelete();
            $table->string('product_type', 150)->nullable();
            $table->string('location', 255)->nullable();
            $table->text('comment');
            $table->string('status', 20)->default('new');
            $table->foreignId('assigned_to')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampTz('consent_at');
            $table->char('ip_hash', 64)->nullable();
            Columns::tracking($table, true);

            $table->unique('reference', 'feedbacks_reference_uq');
        });

        Schema::create('feedback_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feedback_id')->index()->constrained('feedbacks')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->boolean('is_internal')->default(true);
            $table->timestampTz('sent_at')->nullable();
            Columns::tracking($table);
        });

        Schema::create('quote_requests', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->default(DB::raw("fn_next_reference('DEV', 'quote_ref_seq')"));
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->string('last_name', 100);
            $table->string('first_name', 100);
            $table->rawColumn('email', 'citext')->nullable();
            $table->string('phone', 30);
            $table->string('company_name', 200)->nullable();
            $table->foreignId('service_type_id')->index()->constrained('service_types')->restrictOnDelete();
            $table->foreignId('city_id')->index()->constrained('cities')->restrictOnDelete();
            $table->foreignId('district_id')->nullable()->index()->constrained('districts')->nullOnDelete();
            $table->text('description');
            $table->date('desired_start_date')->nullable();
            $table->string('budget_range', 50)->nullable();
            $table->string('status', 20)->default('new');
            $table->foreignId('assigned_to')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('consent_at');
            $table->char('ip_hash', 64)->nullable();
            Columns::tracking($table, true);

            $table->unique('reference', 'quote_requests_reference_uq');
        });

        Schema::create('quote_request_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_request_id')->index()->constrained('quote_requests')->cascadeOnDelete();
            $table->foreignId('provider_id')->index()->constrained('providers')->cascadeOnDelete();
            $table->string('status', 20)->default('sent');
            $table->timestampTz('sent_at')->useCurrent();
            $table->timestampTz('viewed_at')->nullable();
            $table->timestampTz('replied_at')->nullable();
            $table->text('response_message')->nullable();
            $table->integer('quoted_amount')->nullable();
            Columns::tracking($table);

            $table->unique(['quote_request_id', 'provider_id'], 'quote_request_recipients_uq');
        });

        Schema::create('contact_messages', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->rawColumn('email', 'citext')->nullable();
            $table->string('subject', 200);
            $table->text('message');
            $table->string('status', 20)->default('new');
            $table->foreignId('handled_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('handled_at')->nullable();
            $table->timestampTz('consent_at');
            $table->char('ip_hash', 64)->nullable();
            Columns::tracking($table);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_messages');
        Schema::dropIfExists('quote_request_recipients');
        Schema::dropIfExists('quote_requests');
        Schema::dropIfExists('feedback_replies');
        Schema::dropIfExists('feedbacks');
        DB::statement('DROP FUNCTION IF EXISTS fn_next_reference(text, regclass)');
        DB::statement('DROP SEQUENCE IF EXISTS quote_ref_seq');
        DB::statement('DROP SEQUENCE IF EXISTS feedback_ref_seq');
    }
};
