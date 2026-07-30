<?php

namespace App\Services\Dashboard;

use App\Models\Qualidade\ProdutorQualidade;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class QualidadeIndicadorService
{
    private const ANALISES_TABLE = 'resultadosanalises';

    public function resumo(): array
    {
        $produtoresAtivos = ProdutorQualidade::query()->where('ativo', 1)->count();

        if (! Schema::connection('raw')->hasTable(self::ANALISES_TABLE)) {
            return [
                'produtores_ativos' => $produtoresAtivos,
                'produtores_com_analise' => 0,
                'produtores_sem_analise' => $produtoresAtivos,
                'ultima_analise' => null,
            ];
        }

        $analises = DB::connection('raw')
            ->table(self::ANALISES_TABLE.' as ra')
            ->join('produtores as p', 'p.codigo', '=', 'ra.produtor_codigo')
            ->where('p.ativo', 1);
        $produtoresComAnalise = (clone $analises)
            ->whereNotNull('ra.produtor_codigo')
            ->distinct('ra.produtor_codigo')
            ->count('ra.produtor_codigo');

        return [
            'produtores_ativos' => $produtoresAtivos,
            'produtores_com_analise' => $produtoresComAnalise,
            'produtores_sem_analise' => max($produtoresAtivos - $produtoresComAnalise, 0),
            'ultima_analise' => (clone $analises)->max('ra.data'),
        ];
    }
}
