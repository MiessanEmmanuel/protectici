<?php

use App\Models\Provider;
use App\Models\StateForce;
use Illuminate\Http\UploadedFile;

/** PDF minimal valide (sans contenu actif). */
function claimPdf(string $name = 'extrait-rccm.pdf'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
}

/** @return array<string, mixed> */
function claimPayload(array $overrides = []): array
{
    return array_merge([
        'submitter_role' => 'manager',
        'phone' => '07 09 44 51 11',
        'message' => 'Je suis le gérant de cette société.',
        'document' => claimPdf(),
        'consent' => '1',
    ], $overrides);
}

function claimUrl(Provider|StateForce $establishment): string
{
    $type = $establishment instanceof Provider ? 'provider' : 'state_force';

    return '/api/v1/establishments/'.$type.'/'.$establishment->slug.'/claims';
}
