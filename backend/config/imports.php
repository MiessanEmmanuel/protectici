<?php

return [
    // Import Excel des fiches (contrat §10.2, plan_import_etablissements.md §6.4).
    // Disque privé du fichier téléversé : même disque que les justificatifs (jamais servi par URL publique).
    'disk' => env('IMPORTS_DISK') ?: env('DOCUMENTS_DISK', 'private'),
    'max_kb' => 5120,
    'max_rows' => 2000,
    // Protection contre les bombes ZIP : nombre d'entrées et taille décompressée totale.
    'max_zip_entries' => 500,
    'max_uncompressed_bytes' => 50 * 1024 * 1024,
    // Téléversements par administrateur et par heure.
    'uploads_per_hour' => 20,
    'retention_days' => 30,
    'chunk_size' => 100,
];
