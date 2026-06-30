<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function csrf(): JsonResponse
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
        $request->merge([
            'login' => trim((string) ($request->input('login') ?? $request->input('email') ?? '')),
        ]);

        $credentials = $request->validate([
            'login' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string'],
        ]);

        $login = (string) $credentials['login'];
        $user = User::query()
            ->where('usuario', $login)
            ->when(Schema::hasColumn('usuarios', 'email'), function ($query) use ($login) {
                $query->orWhere('email', mb_strtolower($login));
            })
            ->first();

        if (! $user || ! $user->ativo || ! $this->senhaConfere((string) $credentials['password'], (string) $user->senha)) {
            throw ValidationException::withMessages([
                'login' => 'Usuario ou senha invalidos.',
            ]);
        }

        Auth::login($user, false);
        $request->session()->regenerate();
        $user->forceFill(['ultimo_login' => now()])->save();

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
                'message' => 'Sessao encerrada.',
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
            'usuario' => $user->usuario,
            'email' => $user->email,
            'niveis' => $user->niveis ?? [],
            'admin' => (bool) $user->admin,
        ];
    }

    private function senhaConfere(string $plain, string $stored): bool
    {
        $stored = trim($stored);
        if ($plain === '' || $stored === '') {
            return false;
        }

        if (strlen($stored) === 32 && ctype_xdigit($stored)) {
            return hash_equals(strtolower($stored), md5($plain));
        }

        return Hash::check($plain, $stored);
    }
}
