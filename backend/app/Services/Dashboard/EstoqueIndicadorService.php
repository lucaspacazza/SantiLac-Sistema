<?php

namespace App\Services\Dashboard;

use App\Models\Estoque\EstoqueItem;
use App\Services\Estoque\EstoqueService;

class EstoqueIndicadorService
{
    public function __construct(
        private readonly EstoqueService $estoque,
    ) {}

    public function resumo(): array
    {
        $totais = $this->estoque->overview()['totais'] ?? [];

        return [
            'itens_ativos' => (int) ($totais['itens_ativos'] ?? 0),
            'abaixo_minimo' => (int) ($totais['abaixo_minimo'] ?? 0),
            'movimentos_mes' => (int) ($totais['movimentos_mes'] ?? 0),
            'inventory' => EstoqueItem::query()
                ->where('ativo', 1)
                ->orderByRaw('CASE WHEN estoque_minimo > 0 AND saldo_atual <= estoque_minimo THEN 0 ELSE 1 END')
                ->orderBy('nome')
                ->get()
                ->map(fn (EstoqueItem $item): array => [
                    'name' => (string) $item->nome,
                    'unit' => (string) $item->unidade,
                    'stock' => round((float) $item->saldo_atual, 3),
                    'min' => round((float) $item->estoque_minimo, 3),
                    'max' => null,
                ])->values()->all(),
        ];
    }
}
