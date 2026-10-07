<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('state_forces', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignId('force_type_id')->index()->constrained('state_force_types')->restrictOnDelete();
            $table->string('name', 200);
            $table->string('slug', 220)->unique('state_forces_slug_uq');
            $table->text('description')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('phone_alt', 30)->nullable();
            $table->string('emergency_phone', 30)->nullable();
            $table->rawColumn('email', 'citext')->nullable();
            $table->string('address', 255)->nullable();
            $table->foreignId('city_id')->index()->constrained('cities')->restrictOnDelete();
            $table->foreignId('district_id')->nullable()->index()->constrained('districts')->nullOnDelete();
            $table->text('geo_description')->nullable();
            $table->string('plus_code', 20)->nullable();
            Columns::coordinates($table);
            $table->jsonb('opening_hours')->nullable();
            $table->boolean('is_open_24h')->default(false);
            $table->string('status', 20)->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->integer('views_count')->default(0);
            $table->rawColumn('search_vector', 'tsvector')->nullable();
            Columns::visible($table);
            Columns::tracking($table, true);
        });

        Schema::create('state_force_procedure_type', function (Blueprint $table) {
            $table->foreignId('state_force_id')->constrained('state_forces')->cascadeOnDelete();
            $table->foreignId('procedure_type_id')->constrained('procedure_types')->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->primary(['state_force_id', 'procedure_type_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('state_force_procedure_type');
        Schema::dropIfExists('state_forces');
    }
};
