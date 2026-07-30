<?php

namespace App\Services\Dashboard;

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
        ];
    }
}
