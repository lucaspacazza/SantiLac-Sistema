<?php

namespace App\Services\Dashboard;

use Illuminate\Support\Carbon;

class DashboardResumoDiarioService
{
    public function __construct(
        private readonly ColetasResumoService $coletas,
        private readonly ProducaoResumoService $producao,
        private readonly PasteurizadorResumoService $pasteurizador,
        private readonly EstoqueResumoService $estoque,
        private readonly DashboardPendenciasService $pendencias,
    ) {
    }

    public function montar(Carbon $dia): array
    {
        $estoque = $this->estoque->resumo();

        return [
            'data' => $dia->toDateString(),
            'coletas' => $this->coletas->dia($dia),
            'producao' => $this->producao->dia($dia),
            'pasteurizador' => $this->pasteurizador->dia($dia),
            'estoque' => $estoque,
            'pendencias' => $this->pendencias->listar($estoque),
        ];
    }
}
