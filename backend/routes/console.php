<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('app:purge-unverified-users')->daily();
Schedule::command('cache:purge-expired')->hourly()->onOneServer()->withoutOverlapping();

// Rétention (modele.md §5.3, api-contract §8.6) : quotidienne, échelonnée, une seule exécution à la fois.
foreach ([
    'retention:purge-idempotency-keys' => '03:00',
    'retention:purge-contact-messages' => '03:10',
    'retention:anonymize-feedbacks' => '03:20',
    'retention:anonymize-quote-requests' => '03:30',
    'retention:purge-establishment-files' => '03:40',
    'retention:purge-pending-subscribers' => '03:50',
] as $command => $time) {
    Schedule::command($command)->dailyAt($time)->onOneServer()->withoutOverlapping();
}

// Publication planifiée des articles (contrat §9.2) : chaque minute, une seule exécution à la fois.
Schedule::command('posts:publish-scheduled')->everyMinute()->onOneServer()->withoutOverlapping();
