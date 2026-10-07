<?php

namespace App\Logging;

use Illuminate\Log\Logger;
use Monolog\Formatter\LineFormatter;
use Monolog\Handler\FormattableHandlerInterface;
use Monolog\LogRecord;

/**
 * Tap des canaux de log : masque secrets et données personnelles (security.md §20).
 * - clés de contexte sensibles (password, token, authorization, cookie, secret, email, phone…) ;
 * - adresses email et numéros de téléphone présents dans les messages (ex. bindings SQL d'une QueryException).
 */
class RedactSensitiveData
{
    private const KEYS = ['password', 'token', 'authorization', 'cookie', 'secret', 'email', 'phone', 'body', 'comment', 'recovery', 'code'];

    public function __invoke(Logger $logger): void
    {
        /** @var \Monolog\Logger $monolog */
        $monolog = $logger->getLogger();

        foreach ($monolog->getHandlers() as $handler) {
            if ($handler instanceof FormattableHandlerInterface) {
                $handler->setFormatter(new class extends LineFormatter
                {
                    public function format(LogRecord $record): string
                    {
                        return RedactSensitiveData::scrubString(parent::format($record));
                    }
                });
            }
        }

        $monolog->pushProcessor(function (LogRecord $record): LogRecord {
            return $record->with(
                message: RedactSensitiveData::scrubString($record->message),
                context: RedactSensitiveData::scrubArray($record->context),
                extra: RedactSensitiveData::scrubArray($record->extra),
            );
        });
    }

    public static function scrubString(string $text): string
    {
        // Les e-mails journalisés (mailer « log ») sont encodés en quoted-printable : on normalise avant masquage.
        if (str_contains($text, '=3D') || str_contains($text, "=\n") || str_contains($text, "=\r\n")) {
            $text = str_replace(['=3D', "=\r\n", "=\n"], ['=', '', ''], $text);
        }
        if (! (function_exists('config') && app()->bound('config') && config('mail.log_links', false))) {
            $text = preg_replace('/(signature|token)=[A-Za-z0-9._~%\-]+/', '$1=[redacted]', $text) ?? $text;
            $text = preg_replace('#(verify-email/\d+/)[A-Fa-f0-9]{40}#', '$1[redacted]', $text) ?? $text;
        }

        $text = preg_replace('/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/', '[email]', $text) ?? $text;

        // Numéros de téléphone (7 à 15 chiffres, éventuellement groupés / préfixés par +)
        return preg_replace('/(?<![\w.])\+?\d[\d\s.\-]{6,17}\d(?![\w])/', '[phone]', $text) ?? $text;
    }

    /**
     * @param  array<mixed>  $data
     * @return array<mixed>
     */
    public static function scrubArray(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key)) {
                $lower = strtolower($key);
                foreach (self::KEYS as $needle) {
                    if (str_contains($lower, $needle)) {
                        $data[$key] = '[redacted]';

                        continue 2;
                    }
                }
            }
            if (is_array($value)) {
                $data[$key] = self::scrubArray($value);
            }
        }

        return $data;
    }
}
