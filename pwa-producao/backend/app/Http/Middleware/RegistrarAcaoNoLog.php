<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class RegistrarAcaoNoLog
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($request->user() !== null && in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $this->registrar($request, $response->getStatusCode());
        }

        return $response;
    }

    private function registrar(Request $request, int $statusCode): void
    {
        try {
            $user = $request->user();

            DB::connection('raw')->table('logs')->insert([
                'usuario_id' => $user?->getAuthIdentifier(),
                'usuario_nome' => isset($user?->nome) ? (string) $user->nome : null,
                'usuario_email' => isset($user?->email) ? (string) $user->email : null,
                'modulo' => 'fabrica',
                'acao' => strtolower($request->method()),
                'entidade' => 'pwa_producao',
                'entidade_id' => $this->entidadeId($request),
                'descricao' => 'Acao registrada no PWA de producao.',
                'metodo' => $request->method(),
                'rota' => '/'.ltrim($request->path(), '/'),
                'ip' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 500),
                'status_code' => $statusCode,
                'contexto' => json_encode([
                    'payload' => $request->except(['password', 'password_confirmation', '_token']),
                    'query' => $request->query(),
                    'route_params' => $request->route()?->parameters() ?? [],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'created_at' => now('America/Sao_Paulo'),
            ]);
        } catch (Throwable) {
            // Auditoria nao pode derrubar lancamento no chao de fabrica.
        }
    }

    private function entidadeId(Request $request): ?string
    {
        $params = $request->route()?->parameters() ?? [];

        return isset($params['id']) ? (string) $params['id'] : null;
    }
}
