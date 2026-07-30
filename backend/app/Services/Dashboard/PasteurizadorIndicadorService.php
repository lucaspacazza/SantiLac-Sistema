<?php

namespace App\Services\Dashboard;

use App\Services\Pasteurizador\PasteurizadorService;

class PasteurizadorIndicadorService
{
    public function __construct(
        private readonly PasteurizadorService $pasteurizador,
    ) {}

    public function resumo(): array
    {
        $overview = $this->pasteurizador->overview();
        $ultima = $overview['ultima_coleta'] ?? null;

        return [
            'amostras' => (int) ($overview['totais']['amostras'] ?? 0),
            'ultima_coleta' => is_array($ultima) ? [
                'status' => (string) ($ultima['status'] ?? 'rascunho'),
                'coletado_em' => $ultima['coletado_em'] ?? null,
                'total_amostras' => (int) ($ultima['total_amostras'] ?? 0),
            ] : null,
        ];
    }
}
