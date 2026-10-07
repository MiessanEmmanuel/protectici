<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Exception HTTP portant un message français destiné à l'utilisateur (rendu tel quel par ApiExceptionRenderer).
 */
class ApiHttpException extends HttpException
{
    /** @param array<string, string> $headers */
    public function __construct(int $status, string $message, array $headers = [], public readonly ?string $errorCode = null)
    {
        parent::__construct($status, $message, null, $headers);
    }
}
