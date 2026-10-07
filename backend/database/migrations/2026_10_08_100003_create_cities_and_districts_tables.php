<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cities', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique('cities_slug_uq');
            $table->char('country_code', 2)->default('CI');
            Columns::coordinates($table);
            $table->smallInteger('sort_order')->default(0);
            Columns::visible($table);
            Columns::tracking($table);
        });

        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('city_id')->index()->constrained('cities')->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->index()->constrained('districts')->restrictOnDelete();
            $table->string('name', 120);
            $table->string('slug', 140);
            Columns::coordinates($table);
            Columns::visible($table);
            Columns::tracking($table);

            $table->unique(['city_id', 'slug'], 'districts_city_slug_uq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('districts');
        Schema::dropIfExists('cities');
    }
};
