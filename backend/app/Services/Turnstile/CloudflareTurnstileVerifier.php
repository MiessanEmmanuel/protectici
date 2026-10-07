<?php

namespace App\Services\Turnstile;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Vérification côté serveur auprès de Cloudflare (hôte fixe issu de la config : pas de SSRF).
 * Toute erreur réseau ou réponse inattendue = échec (fail closed).
 */
final class CloudflareTurnstileVerifier implements TurnstileVerifier
{
    public function __construct(
        private readonly string $secret,
        private readonly string $verifyUrl,
    ) {}

    public function enabled(): bool
    {
        return true;
    }

    public function verify(string $token, ?string $ip = null): bool
    {
        if ($token === '' || $this->secret === '') {
            return false;
        }

        try {
            $response = Http::asForm()
                ->timeout(5)
                ->connectTimeout(3)
                ->post($this->verifyUrl, array_filter([
                    'secret' => $this->secret,
                    'response' => $token,
                    'remoteip' => $ip,
                ]));
        } catch (Throwable $e) {
            Log::warning('Turnstile : vérification impossible', ['error' => $e::class]);

            return false;
        }

        return $response->successful() && $response->json('success') === true;
    }
}
