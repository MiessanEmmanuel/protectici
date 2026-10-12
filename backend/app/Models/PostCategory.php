<?php

namespace App\Models;

use Database\Factories\PostCategoryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * @property string|null $description
 * @property int $sort_order
 * @property bool $is_visible
 */
class PostCategory extends ReferenceModel
{
    /** @use HasFactory<PostCategoryFactory> */
    use HasFactory;

    protected $table = 'post_categories';
}
