<?php

namespace App\Services\Producao;

use App\Models\ProducaoCreme;
use App\Models\ProducaoFormulacaoCreme;
use App\Models\ProducaoFormulacaoQueijo;
use App\Models\ProducaoOrdemProducao;
use App\Models\ProducaoSoroRefrigerado;

class ProducaoOverviewService
{
    public function overview(): array
    {
        return [
            'totais' => [
                'formulacoes_queijo' => ProducaoFormulacaoQueijo::query()->count(),
                'ordens_producao' => ProducaoOrdemProducao::query()->count(),
                'soro_refrigerado' => ProducaoSoroRefrigerado::query()->count(),
                'formulacoes_creme' => ProducaoFormulacaoCreme::query()->count(),
                'producoes_creme' => ProducaoCreme::query()->count(),
                'ops_aguardando_formato' => ProducaoOrdemProducao::query()->where('status', 'aguardando_formato')->count(),
                'rascunhos' => $this->totalRascunhos(),
            ],
            'submodulos' => [
                [
                    'codigo' => 'formulacao-queijo',
                    'nome' => 'Formulação de Queijo',
                    'documento' => 'PLAN_6.3',
                    'descricao' => 'Ficha operacional ligada a lote, leite, insumos e responsável.',
                    'rota_preenchimento' => 'preenchimento-formulacao-queijo',
                    'rota_listagem' => 'listagem-formulacoes-queijo',
                    'status' => 'ativo',
                ],
                [
                    'codigo' => 'ordem-producao',
                    'nome' => 'Ordem de Produção',
                    'documento' => 'OP',
                    'descricao' => 'Ordem gerada pelas formulações finalizadas.',
                    'rota_preenchimento' => 'preenchimento-ordem-producao',
                    'rota_listagem' => 'ordem-producao',
                    'status' => 'ativo',
                ],
                [
                    'codigo' => 'soro-refrigerado',
                    'nome' => 'Soro Refrigerado',
                    'documento' => 'PLAN_6.7',
                    'descricao' => 'Controle de entrada, estoque, venda e silo de soro refrigerado.',
                    'rota_preenchimento' => 'preenchimento-soro-refrigerado',
                    'rota_listagem' => 'listagem-soro-refrigerado',
                    'status' => 'ativo',
                ],
                [
                    'codigo' => 'formulacao-creme',
                    'nome' => 'Formulação de Creme',
                    'documento' => 'PLAN_6.9',
                    'descricao' => 'Controle de gordura inicial, gordura final e acidez do creme.',
                    'rota_preenchimento' => 'preenchimento-formulacao-creme',
                    'rota_listagem' => 'listagem-formulacoes-creme',
                    'status' => 'ativo',
                ],
                [
                    'codigo' => 'producao-creme',
                    'nome' => 'Produção de Creme de Leite e Soro',
                    'documento' => 'PLAN_6.10',
                    'descricao' => 'Controle de lote, quantidade produzida e tipo de creme.',
                    'rota_preenchimento' => 'preenchimento-producao-creme',
                    'rota_listagem' => 'listagem-producoes-creme',
                    'status' => 'ativo',
                ],
            ],
        ];
    }

    private function totalRascunhos(): int
    {
        return ProducaoFormulacaoQueijo::query()->where('status', 'rascunho')->count()
            + ProducaoOrdemProducao::query()->where('status', 'rascunho')->count()
            + ProducaoSoroRefrigerado::query()->where('status', 'rascunho')->count()
            + ProducaoFormulacaoCreme::query()->where('status', 'rascunho')->count()
            + ProducaoCreme::query()->where('status', 'rascunho')->count();
    }
}
