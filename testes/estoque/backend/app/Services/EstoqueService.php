<?php

namespace App\Services;

use App\Models\EstoqueItem;
use App\Models\EstoqueLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EstoqueService
{
    private const MOVEMENT_TYPES = ['entrada', 'saida', 'ajuste'];

    public function overview(): array
    {
        $baixoEstoque = EstoqueItem::query()
            ->where('ativo', 1)
            ->whereColumn('saldo_atual', '<=', 'estoque_minimo')
            ->where('estoque_minimo', '>', 0)
            ->orderBy('nome')
            ->limit(10)
            ->get()
            ->map(fn (EstoqueItem $item): array => $this->formatarItem($item))
            ->all();

        return [
            'totais' => [
                'itens' => EstoqueItem::query()->count(),
                'itens_ativos' => EstoqueItem::query()->where('ativo', 1)->count(),
                'movimentos_mes' => EstoqueLog::query()
                    ->whereBetween('data_movimento', [
                        now('America/Sao_Paulo')->startOfMonth()->toDateString(),
                        now('America/Sao_Paulo')->endOfMonth()->toDateString(),
                    ])
                    ->count(),
                'abaixo_minimo' => count($baixoEstoque),
            ],
            'alertas' => [
                'baixo_estoque' => $baixoEstoque,
            ],
        ];
    }

    public function itens(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $query = EstoqueItem::query()->orderBy('nome');

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($query) use ($search): void {
                $query
                    ->where('codigo', 'like', "%{$search}%")
                    ->orWhere('nome', 'like', "%{$search}%")
                    ->orWhere('categoria', 'like', "%{$search}%");
            });
        }

        if ($request->filled('categoria')) {
            $query->where('categoria', (string) $request->query('categoria'));
        }

        if ($request->has('ativo')) {
            $query->where('ativo', $request->boolean('ativo'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn (EstoqueItem $item): array => $this->formatarItem($item))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function categorias(): array
    {
        return EstoqueItem::query()
            ->select('categoria')
            ->where('categoria', '<>', '')
            ->distinct()
            ->orderBy('categoria')
            ->pluck('categoria')
            ->values()
            ->all();
    }

    public function item(int $id): ?array
    {
        $item = EstoqueItem::query()->where('id', $id)->first();

        if ($item === null) {
            return null;
        }

        return [
            ...$this->formatarItem($item),
            'movimentos' => $this->movimentosRecentesDoItem($id),
        ];
    }

    public function movimentos(Request $request): array
    {
        $perPage = min(max((int) $request->query('per_page', 50), 1), 100);
        $query = $this->movimentosBase()->orderByDesc('l.data_movimento')->orderByDesc('l.id');

        if ($request->filled('item_id')) {
            $query->where('l.estoque_id', (int) $request->query('item_id'));
        }

        if ($request->filled('tipo')) {
            $query->where('l.tipo', (string) $request->query('tipo'));
        }

        if ($request->filled('data_inicio')) {
            $query->whereDate('l.data_movimento', '>=', (string) $request->query('data_inicio'));
        }

        if ($request->filled('data_fim')) {
            $query->whereDate('l.data_movimento', '<=', (string) $request->query('data_fim'));
        }

        $page = $query->paginate($perPage);

        return [
            'items' => collect($page->items())
                ->map(fn ($movimento): array => $this->formatarMovimento($movimento))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    public function criarItem(array $payload, ?int $usuarioId = null): array
    {
        $item = EstoqueItem::query()->create([
            'codigo' => $payload['codigo'] ?? null,
            'nome' => $payload['nome'],
            'categoria' => $payload['categoria'],
            'descricao' => $payload['descricao'] ?? null,
            'unidade' => $payload['unidade'],
            'saldo_atual' => (float) ($payload['saldo_atual'] ?? 0),
            'estoque_minimo' => (float) ($payload['estoque_minimo'] ?? 0),
            'ativo' => true,
        ]);

        if ((float) ($payload['saldo_atual'] ?? 0) !== 0.0) {
            EstoqueLog::query()->create([
                'estoque_id' => $item->id,
                'tipo' => 'ajuste',
                'quantidade' => (float) $payload['saldo_atual'],
                'saldo_antes' => 0,
                'saldo_depois' => (float) $payload['saldo_atual'],
                'data_movimento' => now('America/Sao_Paulo')->toDateString(),
                'motivo' => 'Saldo inicial',
                'usuario_id' => $usuarioId,
            ]);
        }

        return $this->item((int) $item->id);
    }

    public function atualizarItem(int $id, array $payload): ?array
    {
        $item = EstoqueItem::query()->where('id', $id)->first();

        if ($item === null) {
            return null;
        }

        $item->update([
            'codigo' => $payload['codigo'] ?? null,
            'nome' => $payload['nome'],
            'categoria' => $payload['categoria'],
            'descricao' => $payload['descricao'] ?? null,
            'unidade' => $payload['unidade'],
            'estoque_minimo' => (float) ($payload['estoque_minimo'] ?? 0),
            'ativo' => (bool) ($payload['ativo'] ?? true),
        ]);

        return $this->item((int) $item->id);
    }

    public function registrarMovimento(array $payload, ?int $usuarioId = null): array
    {
        $movimentoId = DB::connection('raw')->transaction(function () use ($payload, $usuarioId): int {
            $tipo = (string) $payload['tipo'];
            if (! in_array($tipo, self::MOVEMENT_TYPES, true)) {
                $this->falharRegra('STOCK_814', 'Tipo de movimentação inválido.');
            }

            $item = EstoqueItem::query()
                ->where('id', (int) $payload['item_id'])
                ->lockForUpdate()
                ->first();

            if ($item === null) {
                $this->falharRegra('STOCK_810', 'Item de estoque não encontrado.');
            }

            if (! $item->ativo) {
                $this->falharRegra('STOCK_813', 'Item de estoque inativo.');
            }

            $quantidade = (float) $payload['quantidade'];
            $saldoAntes = (float) $item->saldo_atual;
            $saldoDepois = $this->calcularSaldoDepois($tipo, $saldoAntes, $quantidade);

            if ($saldoDepois < 0) {
                $this->falharRegra('STOCK_812', 'Saldo insuficiente.');
            }

            $item->update(['saldo_atual' => $saldoDepois]);

            $movimento = EstoqueLog::query()->create([
                'estoque_id' => (int) $item->id,
                'tipo' => $tipo,
                'quantidade' => $quantidade,
                'saldo_antes' => $saldoAntes,
                'saldo_depois' => $saldoDepois,
                'data_movimento' => $payload['data_movimento'],
                'documento' => $payload['documento'] ?? null,
                'motivo' => $payload['motivo'] ?? null,
                'observacao' => $payload['observacao'] ?? null,
                'usuario_id' => $usuarioId,
            ]);

            return (int) $movimento->id;
        });

        $movimento = $this->movimentosBase()->where('l.id', $movimentoId)->first();

        return $this->formatarMovimento($movimento);
    }

    private function calcularSaldoDepois(string $tipo, float $saldoAntes, float $quantidade): float
    {
        return match ($tipo) {
            'entrada' => $saldoAntes + $quantidade,
            'saida' => $saldoAntes - $quantidade,
            'ajuste' => $quantidade,
            default => $saldoAntes,
        };
    }

    private function movimentosBase()
    {
        return DB::connection('raw')
            ->table('estoque_logs as l')
            ->join('estoque as e', 'e.id', '=', 'l.estoque_id')
            ->select([
                'l.id',
                'l.tipo',
                'l.estoque_id as item_id',
                'e.nome as item_nome',
                'e.unidade',
                'l.quantidade',
                'l.saldo_antes',
                'l.saldo_depois',
                'l.data_movimento',
                'l.documento',
                'l.motivo',
                'l.observacao',
                'l.usuario_id',
                'l.created_at',
            ]);
    }

    private function movimentosRecentesDoItem(int $itemId): array
    {
        return $this->movimentosBase()
            ->where('l.estoque_id', $itemId)
            ->orderByDesc('l.data_movimento')
            ->orderByDesc('l.id')
            ->limit(20)
            ->get()
            ->map(fn ($movimento): array => $this->formatarMovimento($movimento))
            ->all();
    }

    private function falharRegra(string $code, string $message): never
    {
        throw ValidationException::withMessages([
            'estoque' => json_encode([
                'code' => $code,
                'message' => $message,
            ], JSON_UNESCAPED_UNICODE),
        ]);
    }

    private function formatarItem(EstoqueItem $item): array
    {
        return [
            'id' => (int) $item->id,
            'codigo' => $item->codigo,
            'nome' => (string) $item->nome,
            'categoria' => (string) $item->categoria,
            'descricao' => $item->descricao,
            'unidade' => (string) $item->unidade,
            'estoque_minimo' => (float) $item->estoque_minimo,
            'saldo_atual' => (float) $item->saldo_atual,
            'saldo_total' => (float) $item->saldo_atual,
            'abaixo_minimo' => (float) $item->estoque_minimo > 0 && (float) $item->saldo_atual <= (float) $item->estoque_minimo,
            'ativo' => (bool) $item->ativo,
        ];
    }

    private function formatarMovimento($movimento): array
    {
        return [
            'id' => (int) $movimento->id,
            'tipo' => (string) $movimento->tipo,
            'item_id' => (int) $movimento->item_id,
            'item_nome' => (string) $movimento->item_nome,
            'unidade' => (string) $movimento->unidade,
            'quantidade' => (float) $movimento->quantidade,
            'saldo_antes' => (float) $movimento->saldo_antes,
            'saldo_depois' => (float) $movimento->saldo_depois,
            'data_movimento' => (string) $movimento->data_movimento,
            'documento' => $movimento->documento,
            'motivo' => $movimento->motivo,
            'observacao' => $movimento->observacao,
            'usuario_id' => $movimento->usuario_id !== null ? (int) $movimento->usuario_id : null,
            'created_at' => $movimento->created_at,
        ];
    }
}
