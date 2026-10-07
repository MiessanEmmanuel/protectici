<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Services\AuditLogger;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;
use Throwable;

/**
 * Double authentification TOTP (security.md §12, modele.md §6.4).
 * Secret et codes de secours sont chiffrés en base (casts `encrypted` du modèle User).
 * Anti-rejeu : un pas TOTP (30 s) déjà utilisé est refusé (dernier pas mémorisé en cache).
 */
class TwoFactorAuthentication
{
    public const SESSION_PENDING_ID = 'auth.two_factor.pending_id';

    public const SESSION_PENDING_REMEMBER = 'auth.two_factor.pending_remember';

    public const SESSION_PENDING_AT = 'auth.two_factor.pending_at';

    public const SESSION_FAILURES = 'auth.two_factor.failures';

    public const RECOVERY_CODES = 8;

    public const WINDOW = 1;

    public const STEP_SECONDS = 30;

    public function __construct(
        private readonly Google2FA $google2fa,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Génère un secret NON confirmé et le QR code associé.
     *
     * @return array{secret: string, qr_svg: string}
     */
    public function enable(User $user): array
    {
        if ($user->hasTwoFactorEnabled()) {
            throw new HttpResponseException(response()->json([
                'message' => __('auth.two_factor_already_enabled'),
            ], 409));
        }

        $secret = $this->google2fa->generateSecretKey(32);

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        return ['secret' => $secret, 'qr_svg' => $this->qrSvg($user, $secret)];
    }

    /**
     * Confirme l'activation avec un code TOTP et renvoie les codes de secours (affichés UNE fois).
     *
     * @return array<int, string>
     */
    public function confirm(User $user, string $code): array
    {
        if ($user->hasTwoFactorEnabled()) {
            throw new HttpResponseException(response()->json([
                'message' => __('auth.two_factor_already_enabled'),
            ], 409));
        }

        if ($user->two_factor_secret === null) {
            throw ValidationException::withMessages(['code' => __('auth.two_factor_not_pending')]);
        }

        if (! $this->verifyCode($user, $code)) {
            throw ValidationException::withMessages(['code' => __('auth.two_factor_invalid')]);
        }

        $codes = $this->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => $codes,
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->audit->record('two_factor_enabled', $user, actor: $user);

        return $codes;
    }

    public function disable(User $user): void
    {
        if ($user->isStaff()) {
            throw new HttpResponseException(response()->json([
                'message' => __('auth.two_factor_required_for_staff'),
            ], 403));
        }

        $wasEnabled = $user->hasTwoFactorEnabled();

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        if ($wasEnabled) {
            $this->audit->record('two_factor_disabled', $user, actor: $user);
        }
    }

    /** Vérifie un code TOTP (fenêtre ±1 pas) en refusant tout pas déjà consommé. */
    public function verifyCode(User $user, string $code): bool
    {
        $secret = $user->two_factor_secret;
        if ($secret === null || preg_match('/^\d{6}$/', $code) !== 1) {
            return false;
        }

        $cacheKey = 'two-factor:last-step:'.$user->getKey();
        $lastStep = Cache::get($cacheKey);
        $currentStep = intdiv(now()->getTimestamp(), self::STEP_SECONDS);

        try {
            $matched = $this->google2fa->verifyKeyNewer(
                $secret,
                $code,
                is_int($lastStep) ? $lastStep : 0,
                self::WINDOW,
                $currentStep,
            );
        } catch (Throwable) {
            return false;
        }

        if ($matched === false) {
            return false;
        }

        Cache::put($cacheKey, is_int($matched) ? $matched : $currentStep, now()->addMinutes(10));

        return true;
    }

    /** Consomme un code de secours (usage unique). */
    public function useRecoveryCode(User $user, string $code): bool
    {
        $code = strtolower(trim($code));
        $codes = $user->two_factor_recovery_codes ?? [];

        foreach ($codes as $index => $candidate) {
            if (hash_equals($candidate, $code)) {
                unset($codes[$index]);
                $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

                return true;
            }
        }

        return false;
    }

    /** @return array<int, string> */
    private function generateRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < self::RECOVERY_CODES; $i++) {
            $raw = bin2hex(random_bytes(5));
            $codes[] = substr($raw, 0, 5).'-'.substr($raw, 5, 5);
        }

        return $codes;
    }

    private function qrSvg(User $user, string $secret): string
    {
        $url = $this->google2fa->getQRCodeUrl((string) config('app.name', 'ProtectIci'), $user->email, $secret);
        $writer = new Writer(new ImageRenderer(new RendererStyle(192, 1), new SvgImageBackEnd));
        $svg = $writer->writeString($url);

        // Sans déclaration XML : intégrable directement dans le DOM.
        return trim((string) preg_replace('/^<\?xml[^>]*\?>/', '', $svg));
    }
}
