<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('newsletter_subscribers', function (Blueprint $table) {
            $table->id();
            $table->rawColumn('email', 'citext')->nullable();
            $table->string('status', 20)->default('pending');
            $table->char('confirmation_token_hash', 64)->nullable();
            $table->timestampTz('confirmed_at')->nullable();
            $table->timestampTz('unsubscribed_at')->nullable();
            $table->string('source', 30)->nullable();
            $table->string('resend_contact_id', 100)->nullable();
            $table->timestampTz('consent_at');
            $table->char('ip_hash', 64)->nullable();
            Columns::tracking($table);

            $table->unique('email', 'newsletter_subscribers_email_uq');
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->jsonb('value');
            $table->boolean('is_public')->default(false);
            $table->foreignId('updated_by')->nullable()->index()->constrained('users')->nullOnDelete();
            Columns::tracking($table);
        });

        Schema::create('consent_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->rawColumn('email', 'citext')->nullable();
            $table->string('purpose', 40);
            $table->string('policy_version', 20);
            $table->boolean('granted');
            $table->char('ip_hash', 64)->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->string('event', 50);
            $table->string('auditable_type', 50)->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->jsonb('context')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type', 255);
            $table->string('notifiable_type', 50);
            $table->unsignedBigInteger('notifiable_id');
            $table->jsonb('data');
            $table->timestampTz('read_at')->nullable();
            Columns::tracking($table);

            $table->index(['notifiable_type', 'notifiable_id'], 'notifications_notifiable_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('consent_logs');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('newsletter_subscribers');
    }
};
