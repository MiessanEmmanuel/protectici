<?php

namespace App\Console\Commands\Content;

use App\Services\Content\PostService;
use Illuminate\Console\Command;

class PublishScheduledPosts extends Command
{
    protected $signature = 'posts:publish-scheduled';

    protected $description = 'Publie les articles planifiés dont la date de publication est atteinte';

    public function handle(PostService $posts): int
    {
        $count = $posts->publishDue();
        $this->info("{$count} article(s) publié(s).");

        return self::SUCCESS;
    }
}
