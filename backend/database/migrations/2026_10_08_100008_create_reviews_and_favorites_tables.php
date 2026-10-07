<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->index()->constrained('providers')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->smallInteger('rating');
            $table->string('title', 150)->nullable();
            $table->text('body');
            $table->string('status', 20)->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->foreignId('moderated_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('moderated_at')->nullable();
            $table->text('provider_reply')->nullable();
            $table->timestampTz('provider_replied_at')->nullable();
            $table->foreignId('provider_replied_by')->nullable()->index()->constrained('users')->nullOnDelete();
            Columns::visible($table);
            Columns::tracking($table, true);
        });

        Schema::create('review_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->index()->constrained('reviews')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->string('reason', 30);
            $table->text('details')->nullable();
            $table->string('status', 20)->default('open');
            $table->foreignId('handled_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('handled_at')->nullable();
            Columns::tracking($table);

            $table->unique(['review_id', 'user_id'], 'review_reports_review_user_uq');
        });

        Schema::create('favorites', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('provider_id')->constrained('providers')->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->primary(['user_id', 'provider_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favorites');
        Schema::dropIfExists('review_reports');
        Schema::dropIfExists('reviews');
    }
};
