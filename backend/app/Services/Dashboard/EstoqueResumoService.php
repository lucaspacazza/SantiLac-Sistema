<?php

namespace App\Services\Dashboard;

use Illuminate\Support\Facades\DB;

class EstoqueResumoService
{
    public function resumo(): array
    {
        $totais = DB::connection('raw')->table('estoque')
            ->selectRaw('COUNT(*) as itens, SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END) as ativos, SUM(CASE WHEN ativo = 1 AND estoque_minimo > 0 AND saldo_atual <= estoque_minimo THEN 1 ELSE 0 END) as abaixo_minimo')
            ->first();

        $categorias = DB::connection('raw')->table('estoque')
            ->selectRaw('categoria, COUNT(*) as itens, COALESCE(SUM(saldo_atual), 0) as saldo')
            ->where('ativo', 1)
            ->groupBy('categoria')
            ->orderByDesc('saldo')
            ->limit(10)
            ->get()
            ->map(fn ($row): array => [
                'categoria' => (string) ($row->categoria ?: 'Sem categoria'),
                'itens' => (int) $row->itens,
                'saldo' => round((float) $row->saldo, 2),
            ])
            ->all();

        return [
            'itens' => (int) ($totais?->itens ?? 0),
            'ativos' => (int) ($totais?->ativos ?? 0),
            'abaixo_minimo' => (int) ($totais?->abaixo_minimo ?? 0),
            'categorias' => $categorias,
        ];
    }
}
