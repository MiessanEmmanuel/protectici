<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->rawColumn('email', 'citext')->nullable();
            $table->timestampTz('email_verified_at')->nullable();
            $table->string('password', 255);
            $table->string('phone', 30)->nullable();
            $table->string('role', 20)->default('user');
            $table->boolean('is_active')->default(true);
            $table->text('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestampTz('two_factor_confirmed_at')->nullable();
            $table->timestampTz('last_login_at')->nullable();
            $table->string('remember_token', 100)->nullable();
            Columns::tracking($table, true);
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->rawColumn('email', 'citext')->nullable();
            $table->primary('email');
            $table->string('token', 255);
            $table->timestampTz('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id', 255)->primary();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->cascadeOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->text('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
