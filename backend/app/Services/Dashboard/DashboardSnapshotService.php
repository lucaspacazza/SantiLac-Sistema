<?php

namespace App\Services\Dashboard;

class DashboardSnapshotService
{
    public function __construct(
        private readonly DashboardDataService $datas,
        private readonly DashboardRotasService $rotas,
        private readonly DashboardHomeResumoService $home,
        private readonly DashboardResumoDiarioService $diario,
    ) {
    }

    public function montar(?string $data = null): array
    {
        $dia = $this->datas->normalizar($data);

        return [
            'data' => $dia->toDateString(),
            'gerado_em' => now('America/Sao_Paulo')->toDateTimeString(),
            'rotas' => $this->rotas->listar(),
            'homeResumo' => $this->home->montar($dia),
            'resumoDiario' => $this->diario->montar($dia),
        ];
    }
}
