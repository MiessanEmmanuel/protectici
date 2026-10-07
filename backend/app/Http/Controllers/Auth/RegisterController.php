<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\RegisterUser;
use Illuminate\Http\JsonResponse;

class RegisterController extends Controller
{
    public function __invoke(RegisterRequest $request, RegisterUser $register): JsonResponse
    {
        /** @var array{first_name: string, last_name: string, email: string, password: string, phone?: string|null} $data */
        $data = $request->safe()->only(['first_name', 'last_name', 'email', 'password', 'phone']);

        $user = $register->handle($request, $data);

        return (new UserResource($user))->response()->setStatusCode(201);
    }
}
