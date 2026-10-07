<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Services\Auth\RegisterUser;
use Illuminate\Http\JsonResponse;

class RegisterController extends Controller
{
    /** Réponse strictement identique quel que soit l'état de l'adresse (anti-énumération). */
    public const MESSAGE = 'Si cette adresse est valide, vous allez recevoir un e-mail pour activer votre compte.';

    public function __invoke(RegisterRequest $request, RegisterUser $register): JsonResponse
    {
        /** @var array{first_name: string, last_name: string, email: string, password: string, phone?: string|null} $data */
        $data = $request->safe()->only(['first_name', 'last_name', 'email', 'password', 'phone']);

        $register->handle($request, $data);

        return response()->json(['message' => self::MESSAGE], 202);
    }
}
