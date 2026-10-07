<?php

return [
    'failed' => 'Ces identifiants ne correspondent à aucun compte.',
    'password' => 'Le mot de passe est incorrect.',
    'throttle' => 'Trop de tentatives. Veuillez réessayer dans :seconds secondes.',

    // Inscription : message générique (pas de confirmation de l'existence d'un compte).
    'register_failed' => 'Impossible de créer le compte avec ces informations.',

    // Double authentification (TOTP).
    'two_factor_invalid' => 'Le code de vérification est invalide.',
    'two_factor_expired' => 'La vérification a expiré. Veuillez vous reconnecter.',
    'two_factor_already_enabled' => 'La double authentification est déjà activée.',
    'two_factor_not_pending' => 'Aucune activation de la double authentification n\'est en cours.',
    'two_factor_required_for_staff' => 'La double authentification est obligatoire pour les comptes d\'administration.',
    'two_factor_setup_required' => 'Veuillez activer la double authentification pour accéder à cet espace.',

    // Vérification de l'adresse e-mail.
    'verification_sent' => 'Un nouveau lien de vérification vous a été envoyé.',
];
