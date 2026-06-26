<?php

namespace App\Services\Dashboard;

class DashboardRotasService
{
    public function listar(): array
    {
        return [
            'home' => '#/dashboard/inicio',
            'resumo_diario' => '#/dashboard/resumo-diario',
            'coletas' => '#/coletas/rotas',
            'producao' => '#/producao/inicio',
            'pasteurizador' => '#/pasteurizador/historico',
            'estoque' => '#/estoque/inicio',
        ];
    }
}
