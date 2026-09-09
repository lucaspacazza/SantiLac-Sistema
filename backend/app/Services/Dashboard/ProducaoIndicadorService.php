<?php

namespace App\Services\Dashboard;

use App\Models\Producao\ProducaoCreme;
use App\Models\Producao\ProducaoFormulacaoQueijo;
use App\Models\Producao\ProducaoOrdemProducao;
use App\Models\Producao\ProducaoSoroRefrigerado;
use App\Services\Dashboard\Support\ProducaoLotesCalculator;
use App\Services\Dashboard\Support\DashboardDateRange;
use App\Services\Producao\ProducaoOverviewService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ProducaoIndicadorService
{
    public function __construct(
        private readonly ProducaoOverviewService $producao,
        private readonly ProducaoLotesCalculator $lotCalculator,
    ) {}

    public function resumo(?DashboardDateRange $range = null): array
    {
        $range ??= DashboardDateRange::from();
        $totais = $this->producao->overview()['totais'] ?? [];

        $detail = $this->detail($range);

        return [
            'formulacoes_queijo' => (int) ($totais['formulacoes_queijo'] ?? 0),
            'ops_aguardando_formato' => (int) ($totais['ops_aguardando_formato'] ?? 0),
            'rascunhos' => (int) ($totais['rascunhos'] ?? 0),
            ...$detail,
        ];
    }

    private function detail(DashboardDateRange $range): array
    {
        $connection = Schema::connection('raw');
        if (! $connection->hasTable('ordens_producao') || ! $connection->hasTable('producao_formulacoes_queijo')) {
            return ['products' => [], 'days' => [], 'lotes' => [], 'rendimento_ponderado' => null, 'atualizado_em' => null];
        }

        $reference = $range->end;
        $start = $range->start;
        $orders = ProducaoOrdemProducao::query()
            ->whereDate('data_ordem', '>=', $start->toDateString())
            ->whereDate('data_ordem', '<=', $reference->toDateString())
            ->orderBy('data_ordem')
            ->orderBy('id')
            ->get();
        $orderIds = $orders->pluck('id')->map(fn ($id): int => (int) $id)->all();
        $legacyIds = $orders->pluck('formulacao_queijo_id')->filter()->map(fn ($id): int => (int) $id)->all();
        $formulations = collect();
        if ($orderIds !== []) {
            $formulations = ProducaoFormulacaoQueijo::query()
                ->where(function ($query) use ($orderIds, $legacyIds): void {
                    $query->whereIn('ordem_producao_id', $orderIds);
                    if ($legacyIds !== []) {
                        $query->orWhereIn('id', $legacyIds);
                    }
                })
                ->get();
        }
        $packaging = collect();
        if ($orderIds !== [] && $connection->hasTable('embalagem_lotes')) {
            $packaging = DB::connection('raw')->table('embalagem_lotes')
                ->whereIn('ordem_producao_id', $orderIds)
                ->get(['ordem_producao_id', 'peso_total', 'caixas_total', 'status'])
                ->groupBy('ordem_producao_id')
                ->map(fn ($items): object => (object) [
                    'peso_total' => (float) $items->sum('peso_total'),
                    'caixas_total' => (int) $items->sum('caixas_total'),
                    'status' => $items->contains(fn ($item): bool => (string) $item->status !== 'finalizado') ? 'aberto' : 'finalizado',
                ]);
        }

        $calculated = $this->lotCalculator->calculate($orders, $formulations, $packaging);
        $days = [];
        for ($offset = 0; $offset < $range->days(); $offset++) {
            $date = $start->addDays($offset)->toDateString();
            $days[$date] = ['date' => $date, 'cheeseMilk' => 0.0, 'creamKg' => 0.0, 'wheyLiters' => 0.0];
        }
        foreach ($calculated['lotes'] as $lot) {
            if (isset($days[$lot['date']])) {
                $days[$lot['date']]['cheeseMilk'] += (float) $lot['milk'];
            }
        }
        if ($connection->hasTable('producao_creme')) {
            ProducaoCreme::query()->whereDate('data_fabricacao', '>=', $start->toDateString())
                ->whereDate('data_fabricacao', '<=', $reference->toDateString())->get()
                ->each(function (ProducaoCreme $item) use (&$days): void {
                    $date = optional($item->data_fabricacao)->toDateString();
                    if ($date !== null && isset($days[$date])) {
                        $days[$date]['creamKg'] += (float) ($item->quantidade_produzida_kg ?? 0);
                    }
                });
        }
        if ($connection->hasTable('producao_soro_refrigerado')) {
            ProducaoSoroRefrigerado::query()->whereDate('data_registro', '>=', $start->toDateString())
                ->whereDate('data_registro', '<=', $reference->toDateString())->get()
                ->each(function (ProducaoSoroRefrigerado $item) use (&$days): void {
                    $date = optional($item->data_registro)->toDateString();
                    if ($date !== null && isset($days[$date])) {
                        $days[$date]['wheyLiters'] += (float) ($item->entrada_diaria_estoque ?? 0);
                    }
                });
        }

        return [
            'products' => $calculated['products'],
            'days' => array_values($days),
            'lotes' => $calculated['lotes'],
            'rendimento_ponderado' => $calculated['rendimento_ponderado'],
            'atualizado_em' => $orders->max('updated_at'),
        ];
    }
}
