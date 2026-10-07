<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, int> table => longueur de name */
    private array $tables = [
        'company_types' => 150,
        'service_types' => 150,
        'state_force_types' => 150,
        'procedure_types' => 150,
        'feedback_topics' => 150,
        'post_categories' => 150,
    ];

    public function up(): void
    {
        foreach ($this->tables as $name => $length) {
            Schema::create($name, function (Blueprint $table) use ($name, $length) {
                $table->id();
                $table->string('slug', 120)->unique("{$name}_slug_uq");
                $table->string('name', $length);
                $table->text('description')->nullable();
                if ($name === 'service_types') {
                    $table->string('icon', 60)->nullable();
                }
                $table->smallInteger('sort_order')->default(0);
                Columns::visible($table);
                Columns::tracking($table);
            });
        }
    }

    public function down(): void
    {
        foreach (array_reverse(array_keys($this->tables)) as $name) {
            Schema::dropIfExists($name);
        }
    }
};
