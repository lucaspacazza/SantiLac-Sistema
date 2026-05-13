<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function csrf(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'token' => csrf_token(),
            ],
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('email', mb_strtolower((string) $credentials['email']))
            ->first();

        if (! $user || ! $user->ativo || ! Hash::check((string) $credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'E-mail ou senha inválidos.',
            ]);
        }

        Auth::login($user, (bool) $request->boolean('remember'));
        $request->session()->regenerate();

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $this->formatUser($user),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'user' => $this->formatUser($request->user()),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'success' => true,
            'data' => [
                'message' => 'Sessão encerrada.',
            ],
        ]);
    }

    private function formatUser(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        return [
            'id' => $user->id,
            'nome' => $user->nome,
            'email' => $user->email,
            'niveis' => $user->niveis ?? [],
        ];
    }
}
