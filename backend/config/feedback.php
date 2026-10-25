<?php

return [
    // Commentaire vocal « Dis-moi tout » (api-contract §8.2 bis) : disque PRIVÉ, jamais servi publiquement. Par défaut
    // le même disque que les justificatifs (`establishments.documents_disk`, variable DOCUMENTS_DISK).
    'voice_disk' => env('FEEDBACK_VOICE_DISK') ?: env('DOCUMENTS_DISK', 'private'),

    // 5 Mo maximum, durée déclarée par le navigateur bornée à 1–120 s.
    'voice_max_kb' => 5120,
    'voice_max_duration_seconds' => 120,
];
