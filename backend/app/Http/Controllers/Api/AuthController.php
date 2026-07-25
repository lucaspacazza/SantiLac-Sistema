<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuarios\User;
use App\Services\Coletas\Mobile\MobileAuthService;
use App\Services\Sistema\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLog,
        private readonly MobileAuthService $mobileAuth
    ) {
    }

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
        if ($request->has('senha') || $request->hasHeader('X-API-Key')) {
            return $this->mobileLogin($request);
        }

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
            $this->auditLog->registrar(
                $request,
                'autenticacao',
                'login_falhou',
                'Tentativa de entrada nao autorizada.',
                ['login' => $login],
                422,
                $user
            );

            throw ValidationException::withMessages([
                'login' => 'Usuario ou senha invalidos.',
            ]);
        }

        Auth::login($user, false);
        $request->session()->regenerate();
        $user->forceFill(['ultimo_login' => now()])->save();

        $this->auditLog->registrar(
            $request,
            'autenticacao',
            'login',
            'Entrada do usuario no sistema.',
            ['remember' => false],
            200,
            $user
        );

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $this->formatUser($user),
                'session_lifetime_seconds' => $this->sessionLifetimeSeconds(),
            ],
        ]);
    }

    private function mobileLogin(Request $request): JsonResponse
    {
        $expected = trim((string) config('services.santilac.api_key', ''));
        $provided = trim((string) ($request->header('X-API-Key') ?: $request->bearerToken() ?: ''));

        if ($expected === '') {
            return response()->json([
                'sucesso' => false,
                'erros' => ['API key não configurada no servidor'],
                'mapeamentos' => [],
                'meta' => [],
            ], 500);
        }

        if ($provided === '' || ! hash_equals($expected, $provided)) {
            return response()->json([
                'sucesso' => false,
                'erros' => [$provided === '' ? 'API key ausente' : 'API key inválida'],
                'mapeamentos' => [],
                'meta' => [],
            ], 401);
        }

        $response = $this->mobileAuth->login(
            (string) $request->input('login', ''),
            (string) $request->input('senha', '')
        );

        return response()->json($response, $response['sucesso'] ? 200 : 422);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'user' => $this->formatUser($request->user()),
                'session_lifetime_seconds' => $this->sessionLifetimeSeconds(),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->auditLog->registrar(
            $request,
            'autenticacao',
            'logout',
            'Saida do usuario do sistema.',
            [],
            200,
            $user
        );

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

    private function sessionLifetimeSeconds(): int
    {
        return max(60, (int) config('session.lifetime', 120) * 60);
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
