<?php

namespace App\Console\Commands\Retention;

class RunRetention extends RetentionCommand
{
    protected $signature = 'retention:run';

    protected $description = 'Exécute toutes les commandes de rétention à la suite';

    private const COMMANDS = [
        'retention:purge-idempotency-keys',
        'retention:purge-contact-messages',
        'retention:anonymize-feedbacks',
        'retention:anonymize-quote-requests',
        'retention:purge-establishment-files',
    ];

    public function handle(): int
    {
        $status = self::SUCCESS;
        foreach (self::COMMANDS as $command) {
            if ($this->call($command) !== self::SUCCESS) {
                $status = self::FAILURE;
            }
        }

        return $status;
    }
}
