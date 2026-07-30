<?php

namespace App\Services\Dashboard;

use App\Services\Producao\ProducaoOverviewService;

class ProducaoIndicadorService
{
    public function __construct(
        private readonly ProducaoOverviewService $producao,
    ) {}

    public function resumo(): array
    {
        $totais = $this->producao->overview()['totais'] ?? [];

        return [
            'formulacoes_queijo' => (int) ($totais['formulacoes_queijo'] ?? 0),
            'ops_aguardando_formato' => (int) ($totais['ops_aguardando_formato'] ?? 0),
            'rascunhos' => (int) ($totais['rascunhos'] ?? 0),
        ];
    }
}
