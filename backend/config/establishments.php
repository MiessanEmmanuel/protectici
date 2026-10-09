<?php

return [
    // Limites d'inscription d'établissement (security.md §18) : comptées sur les créations réelles uniquement.
    'submissions_per_ip_per_day' => (int) env('ESTABLISHMENT_SUBMISSIONS_PER_IP_PER_DAY', 3),
    'submissions_per_user_per_day' => (int) env('ESTABLISHMENT_SUBMISSIONS_PER_USER_PER_DAY', 5),

    // Disques de stockage (Laravel Filesystem) : `public` en local ; en staging/production, un disque S3-compatible
    // (ex. Cloudflare R2). Les justificatifs vont TOUJOURS sur un disque privé, jamais servi par URL publique.
    'media_disk' => env('MEDIA_DISK', 'public'),
    'documents_disk' => env('DOCUMENTS_DISK', 'private'),

    // Images publiques (security.md §16) : 5 Mo, 10 en galerie, dimensions bornées, réencodées en WebP.
    'media' => [
        'max_kb' => 5120,
        'gallery_max' => 10,
        'max_pixels' => 16_000_000,
        'max_edge' => ['logo' => 1024, 'cover' => 2400, 'gallery' => 2048],
        'webp_quality' => 82,
    ],

    // Justificatifs (security.md §16) : PDF/JPEG/PNG, 10 Mo, 5 par fiche.
    'documents' => [
        'max_kb' => 10240,
        'max_per_establishment' => 5,
        'max_edge' => 4000,
    ],
];
