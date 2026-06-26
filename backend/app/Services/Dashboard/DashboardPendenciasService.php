<?php

namespace App\Services\Dashboard;

class DashboardPendenciasService
{
    public function listar(array $estoque): array
    {
        if (($estoque['abaixo_minimo'] ?? 0) <= 0) {
            return [];
        }

        return [
            [
                'tipo' => 'Estoque',
                'nivel' => 'atencao',
                'texto' => 'Itens abaixo do estoque mínimo.',
            ],
        ];
    }
}
