<?php

/*
| Formulaires publics (security.md §15 et §18). Limites appliquées uniquement aux créations RÉELLES : un rejeu
| idempotent, une erreur de validation ou un envoi piégé (honeypot) ne consomment pas le quota.
*/
return [
    'limits' => [
        'feedback' => ['ip_per_hour' => (int) env('FEEDBACK_PER_IP_PER_HOUR', 5), 'email_per_day' => (int) env('FEEDBACK_PER_EMAIL_PER_DAY', 10)],
        'quote' => ['ip_per_hour' => (int) env('QUOTE_PER_IP_PER_HOUR', 5), 'email_per_day' => (int) env('QUOTE_PER_EMAIL_PER_DAY', 10)],
        'contact' => ['ip_per_hour' => (int) env('CONTACT_PER_IP_PER_HOUR', 5), 'email_per_day' => (int) env('CONTACT_PER_EMAIL_PER_DAY', 10)],
    ],
    'reviews_per_day_per_user' => (int) env('REVIEWS_PER_DAY_PER_USER', 10),
    'track_per_hour_per_ip' => (int) env('FEEDBACK_TRACK_PER_IP_PER_HOUR', 10),
    'track_per_hour_per_reference' => (int) env('FEEDBACK_TRACK_PER_REFERENCE_PER_HOUR', 5),
];
