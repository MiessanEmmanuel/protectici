<?php

use App\Logging\RedactSensitiveData;

it('masque de vrais numéros de téléphone', function (string $phone) {
    expect(RedactSensitiveData::scrubString("Appel au {$phone} demandé"))->toBe('Appel au [phone] demandé');
})->with(['+225 07 09 44 51 11', '0709445111', '+2250709445111', '07.09.44.51.11', '07-09-44-51-11']);

it('ne masque ni les adresses IPv4 ni les horodatages de liens ni les versions', function () {
    $text = 'Serveur http://127.0.0.1:8001/api/v1/x?expires=1790000000&foo=1 depuis 192.168.10.25 le [2026-10-08 22:17:00] ok';

    $out = RedactSensitiveData::scrubString($text);

    expect($out)->toContain('127.0.0.1')
        ->toContain('expires=1790000000')
        ->toContain('192.168.10.25')
        ->not->toContain('[phone]');
});

it('masque toujours les e-mails et les jetons de signature', function () {
    config(['mail.log_links' => false]);
    $out = RedactSensitiveData::scrubString('a@b.ci signature=abc123DEF expires=1790000000');

    expect($out)->toContain('[email]')->toContain('signature=[redacted]')->toContain('expires=1790000000');
});
