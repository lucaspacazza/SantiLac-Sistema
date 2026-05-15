<?php

namespace App\Http\Middleware;

use App\Services\Sistema\AuditLogService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RegistrarAcaoNoLog
{
    public function __construct(
        private readonly AuditLogService $auditLog
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($this->deveRegistrar($request)) {
            $this->auditLog->registrarAcaoDaApi($request, $response->getStatusCode());
        }

        return $response;
    }

    private function deveRegistrar(Request $request): bool
    {
        return $request->user() !== null
            && in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    }
}
