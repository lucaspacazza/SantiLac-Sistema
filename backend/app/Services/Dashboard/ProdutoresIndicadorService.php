<?php

namespace App\Services\Dashboard;

use App\Models\Produtores\Produtor;

class ProdutoresIndicadorService
{
    public function total(): int
    {
        return Produtor::query()
            ->where('ativo', true)
            ->count();
    }
}
