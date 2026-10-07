<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignId('category_id')->constrained('post_categories')->restrictOnDelete();
            $table->string('title', 200);
            $table->string('slug', 220)->unique('posts_slug_uq');
            $table->string('excerpt', 500)->nullable();
            $table->text('body');
            $table->string('status', 20)->default('draft');
            $table->timestampTz('published_at')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_flash')->default(false);
            $table->integer('views_count')->default(0);
            $table->smallInteger('reading_minutes')->nullable();
            $table->string('seo_title', 160)->nullable();
            $table->string('seo_description', 300)->nullable();
            $table->rawColumn('search_vector', 'tsvector')->nullable();
            Columns::visible($table);
            Columns::tracking($table, true);
        });

        Schema::create('post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->index()->constrained('posts')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignId('parent_id')->nullable()->index()->constrained('post_comments')->cascadeOnDelete();
            $table->text('body');
            $table->string('status', 20)->default('pending');
            $table->foreignId('moderated_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestampTz('moderated_at')->nullable();
            Columns::visible($table);
            Columns::tracking($table, true);
        });

        Schema::create('pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->unique('pages_slug_uq');
            $table->string('title', 200);
            $table->text('body');
            $table->string('seo_title', 160)->nullable();
            $table->string('seo_description', 300)->nullable();
            $table->foreignId('updated_by')->nullable()->index()->constrained('users')->nullOnDelete();
            Columns::visible($table);
            Columns::tracking($table, true);
        });

        Schema::create('partners', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10);
            $table->string('name', 150);
            $table->string('website_url', 255)->nullable();
            $table->text('description')->nullable();
            $table->smallInteger('sort_order')->default(0);
            Columns::visible($table);
            Columns::tracking($table, true);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partners');
        Schema::dropIfExists('pages');
        Schema::dropIfExists('post_comments');
        Schema::dropIfExists('posts');
    }
};
