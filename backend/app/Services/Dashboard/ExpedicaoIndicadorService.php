<?php

namespace App\Services\Dashboard;

use App\Services\Expedicao\ExpedicaoService;

class ExpedicaoIndicadorService
{
    public function __construct(
        private readonly ExpedicaoService $expedicao,
    ) {}

    public function resumo(): array
    {
        $resumo = $this->expedicao->resumo();
        $totais = $resumo['totais'] ?? [];

        return [
            'totais' => [
                'paletes' => (int) ($totais['paletes'] ?? 0),
                'caixas' => (int) ($totais['caixas'] ?? 0),
                'peso_total' => (float) ($totais['peso_total'] ?? 0),
                'reservados' => (int) ($totais['reservados'] ?? 0),
                'ordens_abertas' => (int) ($totais['ordens_abertas'] ?? 0),
            ],
            'produtos' => collect($resumo['produtos'] ?? [])->map(fn (array $produto): array => [
                'produto' => (string) ($produto['produto'] ?? ''),
                'paletes' => (int) ($produto['paletes'] ?? 0),
                'caixas' => (int) ($produto['caixas'] ?? 0),
                'peso_total' => (float) ($produto['peso_total'] ?? 0),
            ])->values()->all(),
        ];
    }
}
