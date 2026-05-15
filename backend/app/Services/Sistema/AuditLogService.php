<?php

namespace App\Services\Sistema;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

class AuditLogService
{
    public function registrar(
        Request $request,
        string $modulo,
        string $acao,
        string $descricao,
        array $contexto = [],
        ?int $statusCode = null,
        ?Authenticatable $usuario = null
    ): void {
        try {
            $usuario ??= $request->user();

            DB::connection('raw')->table('logs')->insert([
                'usuario_id' => $usuario?->getAuthIdentifier(),
                'usuario_nome' => $this->valorUsuario($usuario, 'nome'),
                'usuario_email' => $this->valorUsuario($usuario, 'email'),
                'modulo' => $modulo,
                'acao' => $acao,
                'entidade' => $contexto['entidade'] ?? null,
                'entidade_id' => $contexto['entidade_id'] ?? null,
                'descricao' => $descricao,
                'metodo' => $request->method(),
                'rota' => '/' . ltrim($request->path(), '/'),
                'ip' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 500),
                'status_code' => $statusCode,
                'contexto' => json_encode($this->normalizarContexto($contexto), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'created_at' => now('America/Sao_Paulo'),
            ]);
        } catch (Throwable) {
            // O log de auditoria nunca pode derrubar a operação principal.
        }
    }

    public function registrarAcaoDaApi(Request $request, int $statusCode): void
    {
        [$modulo, $acao, $descricao] = $this->classificarRequisicao($request);
        $contexto = [
            'payload' => $this->payloadSeguro($request),
            'query' => $request->query(),
            'route_params' => $request->route()?->parameters() ?? [],
        ];

        $parametros = $request->route()?->parameters() ?? [];
        if (isset($parametros['id'])) {
            $contexto['entidade_id'] = (string) $parametros['id'];
        } elseif (isset($parametros['codigo'])) {
            $contexto['entidade_id'] = (string) $parametros['codigo'];
        }

        $this->registrar($request, $modulo, $acao, $descricao, $contexto, $statusCode);
    }

    private function classificarRequisicao(Request $request): array
    {
        $path = $request->path();
        $method = $request->method();

        if (str_contains($path, 'qualidade/analises/importacoes')) {
            return ['qualidade', 'importacao', 'Importação de análises laboratoriais.'];
        }

        if (str_contains($path, 'qualidade/relatorios/exportacoes')) {
            return ['qualidade', 'exportacao', 'Exportação de relatório de qualidade.'];
        }

        if (str_contains($path, 'estoque/movimentos')) {
            return ['estoque', 'movimentacao', 'Movimentação de estoque.'];
        }

        if (str_contains($path, 'estoque/itens') && $method === 'POST') {
            return ['estoque', 'criacao', 'Criação de item de estoque.'];
        }

        if (str_contains($path, 'estoque/itens') && in_array($method, ['PATCH', 'PUT'], true)) {
            return ['estoque', 'edicao', 'Edição de item de estoque.'];
        }

        return ['sistema', strtolower($method), 'Ação operacional no sistema.'];
    }

    private function payloadSeguro(Request $request): array
    {
        $payload = $request->except(['password', 'password_confirmation', '_token']);

        foreach ($request->files->all() as $field => $file) {
            $payload[$field] = $this->normalizarArquivo($file);
        }

        return $payload;
    }

    private function normalizarArquivo(mixed $file): mixed
    {
        if ($file instanceof UploadedFile) {
            return [
                'nome' => $file->getClientOriginalName(),
                'tipo' => $file->getClientMimeType(),
                'tamanho' => $file->getSize(),
            ];
        }

        if (is_array($file)) {
            return array_map(fn (mixed $item): mixed => $this->normalizarArquivo($item), $file);
        }

        return null;
    }

    private function normalizarContexto(array $contexto): array
    {
        unset($contexto['entidade'], $contexto['entidade_id']);

        return $contexto;
    }

    private function valorUsuario(?Authenticatable $usuario, string $campo): ?string
    {
        if ($usuario === null) {
            return null;
        }

        return isset($usuario->{$campo}) ? (string) $usuario->{$campo} : null;
    }
}
