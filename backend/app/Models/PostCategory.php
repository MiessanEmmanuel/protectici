<?php

namespace App\Models;

use Database\Factories\PostCategoryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PostCategory extends ReferenceModel
{
    /** @use HasFactory<PostCategoryFactory> */
    use HasFactory;

    protected $table = 'post_categories';
}
