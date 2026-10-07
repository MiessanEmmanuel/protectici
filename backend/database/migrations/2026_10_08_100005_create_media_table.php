<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->string('mediable_type', 50);
            $table->unsignedBigInteger('mediable_id');
            $table->string('collection', 30);
            $table->string('disk', 20)->default('public');
            $table->string('path', 500)->unique('media_path_uq');
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->integer('size_bytes');
            $table->integer('width')->nullable();
            $table->integer('height')->nullable();
            $table->string('alt_text', 255)->nullable();
            $table->smallInteger('sort_order')->default(0);
            Columns::tracking($table, true);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
