<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Models\User;
use App\Services\Auth\UpdatePassword;
use Illuminate\Http\Response;

class PasswordController extends Controller
{
    public function __invoke(UpdatePasswordRequest $request, UpdatePassword $updater): Response
    {
        /** @var User $user */
        $user = $request->user();

        $updater->handle($request, $user, (string) $request->validated('password'));

        return response()->noContent();
    }
}
