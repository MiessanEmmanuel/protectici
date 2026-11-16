<?php

use App\Notifications\Feedback\FeedbackMail;
use Illuminate\Support\Facades\Notification;

it('rend les e-mails dans le gabarit ProtectIci, entièrement en français', function () {
    $mail = (new FeedbackMail(FeedbackMail::STATUS_CHANGED, 'DMT-2026-000042', 'Awa', 'resolved'))
        ->toMail(Notification::route('mail', 'awa.traore@exemple.test'));
    $html = (string) $mail->render();

    expect($html)
        ->toContain('PROTECTICI')
        ->toContain('/elephant-icon-192.png')
        ->toContain('Si le bouton « Suivre mon dossier » ne fonctionne pas')
        ->toContain('Abidjan Plateau')
        ->toContain('#0343A4')
        ->not->toContain("If you're having trouble")
        ->not->toContain('All rights reserved')
        ->not->toContain('Laravel');
});
