<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('app:purge-unverified-users')->daily();

// Rétention (modele.md §5.3, api-contract §8.6) : quotidienne, échelonnée, une seule exécution à la fois.
foreach ([
    'retention:purge-idempotency-keys' => '03:00',
    'retention:purge-contact-messages' => '03:10',
    'retention:anonymize-feedbacks' => '03:20',
    'retention:anonymize-quote-requests' => '03:30',
    'retention:purge-establishment-files' => '03:40',
] as $command => $time) {
    Schedule::command($command)->dailyAt($time)->onOneServer()->withoutOverlapping();
}
