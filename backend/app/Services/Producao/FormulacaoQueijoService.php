<?php

namespace App\Services\Producao;

use App\Models\ProducaoFormulacaoQueijo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FormulacaoQueijoService extends BaseFormularioService
{
    public function catalogos(): array
    {
        return [
            'queijos' => $this->catalogoQueijos(),
            'insumos' => $this->catalogoInsumos(),
        ];
    }

    public function listar(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $query = ProducaoFormulacaoQueijo::query()->orderByDesc('data_formulacao')->orderByDesc('id');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query
                    ->where('tipo_queijo', 'like', "%{$search}%")
                    ->orWhere('codigo_formulacao', 'like', "%{$search}%")
                    ->orWhere('lote_queijo', 'like', "%{$search}%")
                    ->orWhere('lote_leite', 'like', "%{$search}%");
            });
        }

        if ($request->filled('data')) {
            $query->whereDate('data_formulacao', (string) $request->query('data'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn (ProducaoFormulacaoQueijo $formulacao): array => $this->formatar($formulacao))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function criar(array $payload, ?int $usuarioId = null): array
    {
        $id = DB::connection('raw')->transaction(function () use ($payload, $usuarioId): int {
            $insumos = $payload['insumos'] ?? [];
            unset($payload['insumos']);
            $payload['tipo_queijo'] = (string) ($payload['tipo_queijo'] ?? '');
            $payload['lote_queijo'] = (string) ($payload['lote_queijo'] ?? '');

            $formulacao = ProducaoFormulacaoQueijo::query()->create([
                ...$payload,
                'responsavel_id' => $usuarioId,
                'documento_codigo' => 'PLAN_6.3',
                'documento_nome' => 'Controle de formulação do queijo',
                'status' => 'rascunho',
                'insumos_json' => array_values($insumos),
            ]);
            $formulacao->codigo_formulacao = $this->codigo($formulacao);
            $formulacao->save();

            return (int) $formulacao->id;
        });

        return $this->buscar($id);
    }

    public function atualizar(int $id, array $payload, ?int $usuarioId = null): array|bool|null
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $id)->first();

        if ($formulacao === null) {
            return null;
        }

        if ($formulacao->status !== 'rascunho') {
            return false;
        }

        DB::connection('raw')->transaction(function () use ($formulacao, $payload, $usuarioId): void {
            $insumos = $payload['insumos'] ?? [];
            unset($payload['insumos']);
            $payload['tipo_queijo'] = (string) ($payload['tipo_queijo'] ?? '');
            $payload['lote_queijo'] = (string) ($payload['lote_queijo'] ?? '');

            $formulacao->fill([
                ...$payload,
                'responsavel_id' => $usuarioId,
                'status' => 'rascunho',
                'insumos_json' => array_values($insumos),
            ]);
            $formulacao->save();
        });

        return $this->buscar($id);
    }

    public function finalizar(int $id): ?array
    {
        return $this->finalizarFormulario(ProducaoFormulacaoQueijo::class, $id, fn (int $id): ?array => $this->buscar($id));
    }

    public function cancelar(int $id): ?array
    {
        return $this->cancelarFormulario(ProducaoFormulacaoQueijo::class, $id, fn (int $id): ?array => $this->buscar($id));
    }

    public function buscar(int $id): ?array
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $id)->first();

        return $formulacao === null ? null : $this->formatar($formulacao);
    }

    public function diaPorId(int $id): ?array
    {
        $formulacao = ProducaoFormulacaoQueijo::query()->where('id', $id)->first();

        if ($formulacao === null) {
            return null;
        }

        $data = optional($formulacao->data_formulacao)->toDateString();
        $items = ProducaoFormulacaoQueijo::query()
            ->whereDate('data_formulacao', $data)
            ->orderByRaw('CAST(numero_queijomatic AS UNSIGNED) ASC')
            ->orderBy('id')
            ->get()
            ->map(fn (ProducaoFormulacaoQueijo $item): array => $this->formatar($item))
            ->values()
            ->all();

        return [
            'id' => (int) $formulacao->id,
            'documento_codigo' => 'PLAN_6.3',
            'data_formulacao' => $data,
            'items' => $items,
        ];
    }

    public function formatar(ProducaoFormulacaoQueijo $formulacao): array
    {
        return [
            'id' => (int) $formulacao->id,
            'codigo_formulacao' => $formulacao->codigo_formulacao ?: $this->codigo($formulacao),
            'ordem_producao_id' => null,
            'documento_codigo' => (string) $formulacao->documento_codigo,
            'tipo_queijo' => (string) $formulacao->tipo_queijo,
            'data_formulacao' => optional($formulacao->data_formulacao)->toDateString(),
            'silo' => $formulacao->silo,
            'lote_leite' => $formulacao->lote_leite,
            'lote_queijo' => (string) $formulacao->lote_queijo,
            'numero_queijomatic' => $formulacao->numero_queijomatic,
            'inicio_enchimento' => $formulacao->inicio_enchimento,
            'quantidade_leite' => $formulacao->quantidade_leite !== null ? (float) $formulacao->quantidade_leite : null,
            'temperatura_pasteurizacao' => $formulacao->temperatura_pasteurizacao !== null ? (float) $formulacao->temperatura_pasteurizacao : null,
            'fosfatase' => $formulacao->fosfatase,
            'peroxidase' => $formulacao->peroxidase,
            'gordura_inicial' => $formulacao->gordura_inicial !== null ? (float) $formulacao->gordura_inicial : null,
            'gordura_final' => $formulacao->gordura_final !== null ? (float) $formulacao->gordura_final : null,
            'acidez' => $formulacao->acidez !== null ? (float) $formulacao->acidez : null,
            'temperatura_coagulacao' => $formulacao->temperatura_coagulacao !== null ? (float) $formulacao->temperatura_coagulacao : null,
            'hora_coagulacao' => $formulacao->hora_coagulacao,
            'hora_corte' => $formulacao->hora_corte,
            'temperatura_cozimento' => $formulacao->temperatura_cozimento !== null ? (float) $formulacao->temperatura_cozimento : null,
            'responsavel_id' => $formulacao->responsavel_id !== null ? (int) $formulacao->responsavel_id : null,
            'status' => $this->status($formulacao),
            'observacoes' => $formulacao->observacoes,
            'insumos' => collect($formulacao->insumos_json ?? [])
                ->map(fn (array $insumo, int $index): array => [
                    'id' => $index + 1,
                    'tipo_insumo' => (string) ($insumo['tipo_insumo'] ?? 'outro'),
                    'nome_insumo' => $insumo['nome_insumo'] ?? null,
                    'quantidade' => (float) ($insumo['quantidade'] ?? 0),
                    'unidade' => (string) ($insumo['unidade'] ?? ''),
                    'lote_insumo' => $insumo['lote_insumo'] ?? null,
                ])
                ->values()
                ->all(),
        ];
    }

    private function codigo(ProducaoFormulacaoQueijo $formulacao): string
    {
        $data = optional($formulacao->data_formulacao)->format('Ymd') ?: now('America/Sao_Paulo')->format('Ymd');

        return sprintf('FQ-%s-%06d', $data, (int) $formulacao->id);
    }

    private function catalogoQueijos(): array
    {
        if (! $this->tabelaExiste('producao_queijos')) {
            return [];
        }

        return DB::connection('raw')
            ->table('producao_queijos')
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get()
            ->map(fn (object $queijo): array => [
                'id' => (int) ($queijo->id ?? 0),
                'slug' => (string) ($queijo->slug ?? ''),
                'nome' => (string) ($queijo->nome ?? ''),
                'codigo_balanca' => (string) ($queijo->codigo_balanca ?? ''),
            ])
            ->filter(fn (array $queijo): bool => $queijo['slug'] !== '' && $queijo['nome'] !== '')
            ->values()
            ->all();
    }

    private function catalogoInsumos(): array
    {
        if (! $this->tabelaExiste('insumos')) {
            return [];
        }

        return DB::connection('raw')
            ->table('insumos')
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get()
            ->map(function (object $insumo): array {
                $nome = (string) ($insumo->nome ?? '');

                return [
                    'id' => (int) ($insumo->id ?? 0),
                    'nome' => $nome,
                    'tipo_insumo' => $this->tipoInsumoPorNome($nome),
                    'unidade' => (string) ($insumo->un_base ?? ''),
                ];
            })
            ->filter(fn (array $insumo): bool => $insumo['nome'] !== '' && $insumo['unidade'] !== '')
            ->values()
            ->all();
    }

    private function tipoInsumoPorNome(string $nome): string
    {
        $base = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($nome));
        $base = strtolower($base !== false ? $base : trim($nome));

        return match (true) {
            str_contains($base, 'mvd') => 'fermento_mvd',
            str_contains($base, 'fast') => 'fermento_fast',
            str_contains($base, 'fermento') => 'fermento',
            str_contains($base, 'cloreto') => 'cloreto',
            str_contains($base, 'corante') => 'corante',
            str_contains($base, 'coalho') => 'coalho',
            default => 'outro',
        };
    }

    private function tabelaExiste(string $tabela): bool
    {
        return DB::connection('raw')
            ->table('information_schema.TABLES')
            ->whereRaw('TABLE_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', $tabela)
            ->exists();
    }
}
