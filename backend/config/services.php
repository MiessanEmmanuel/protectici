<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
        // Synchronisation des abonnés confirmés vers une Audience Resend (contrat §9.2) : désactivée par défaut.
        'newsletter_sync' => (bool) env('NEWSLETTER_RESEND_SYNC', false),
        'audience_id' => env('RESEND_AUDIENCE_ID'),
        'api_url' => 'https://api.resend.com',
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Rendu serveur Next.js (conteneur `web`) : secret partagé qui ouvre un plafond de lecture publique distinct.
    'ssr' => [
        'secret' => env('SSR_SHARED_SECRET'),
        'per_minute' => (int) env('SSR_RATE_PER_MINUTE', 1200),
    ],

    'turnstile' => [
        'enabled' => (bool) env('TURNSTILE_ENABLED', true),
        'secret' => env('TURNSTILE_SECRET_KEY'),
        'verify_url' => 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    ],

    'nominatim' => [
        'url' => env('NOMINATIM_URL', 'https://nominatim.openstreetmap.org/search'),
        'user_agent' => env('NOMINATIM_USER_AGENT', 'ProtectIci/1.0 (+https://protectici.example; contact@protectici.example)'),
        'country_codes' => 'ci',
        'cache_ttl' => (int) env('NOMINATIM_CACHE_TTL', 86400),
    ],

];
