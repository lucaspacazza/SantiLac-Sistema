<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ColetasMobileApiKey
{
    public function handle(Request $request, Closure $next): Response
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

        return $next($request);
    }
}
