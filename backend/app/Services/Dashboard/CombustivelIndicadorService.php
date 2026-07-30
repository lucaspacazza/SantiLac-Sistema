<?php

namespace App\Services\Dashboard;

use App\Services\Combustivel\CombustivelService;

class CombustivelIndicadorService
{
    public function __construct(
        private readonly CombustivelService $combustivel,
    ) {}

    public function resumo(): array
    {
        $resumo = $this->combustivel->resumo();

        return [
            'capacidade_litros' => (float) ($resumo['capacidade_litros'] ?? 0),
            'estoque_atual_litros' => (float) ($resumo['estoque_atual_litros'] ?? 0),
            'porcentagem' => (float) ($resumo['porcentagem'] ?? 0),
        ];
    }
}
