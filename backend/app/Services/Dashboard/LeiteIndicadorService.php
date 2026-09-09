<?php

namespace App\Services\Dashboard;

use App\Services\Dashboard\Support\LeiteDiarioCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LeiteIndicadorService
{
    public function __construct(
        private readonly LeiteDiarioCalculator $dailyCalculator,
    ) {}

    public function evolucaoMensal(): array
    {
        $inicioMesAtual = CarbonImmutable::now(config('app.timezone'))->startOfMonth();
        $inicioProximoMes = $inicioMesAtual->addMonth();
        $inicioMesAnterior = $inicioMesAtual->subMonth();
        $inicioSerie = $inicioMesAtual->subMonths(11);

        $totais = DB::connection('raw')
            ->table('coletas')
            ->where('datahora', '>=', $inicioMesAnterior->format('Y-m-d H:i:s'))
            ->where('datahora', '<', $inicioProximoMes->format('Y-m-d H:i:s'))
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN datahora >= ? THEN litros ELSE 0 END), 0) AS mes_atual, '
                .'COALESCE(SUM(CASE WHEN datahora < ? THEN litros ELSE 0 END), 0) AS mes_anterior',
                [
                    $inicioMesAtual->format('Y-m-d H:i:s'),
                    $inicioMesAtual->format('Y-m-d H:i:s'),
                ]
            )
            ->first();

        $mesAtual = round((float) ($totais?->mes_atual ?? 0), 2);
        $mesAnterior = round((float) ($totais?->mes_anterior ?? 0), 2);
        $variacao = $mesAnterior > 0
            ? round((($mesAtual - $mesAnterior) / $mesAnterior) * 100, 2)
            : null;

        $totaisMensais = DB::connection('raw')
            ->table('coletas')
            ->where('datahora', '>=', $inicioSerie->format('Y-m-d H:i:s'))
            ->where('datahora', '<', $inicioProximoMes->format('Y-m-d H:i:s'))
            ->selectRaw("DATE_FORMAT(datahora, '%Y-%m') AS periodo, COALESCE(SUM(litros), 0) AS litros, COUNT(*) AS coletas")
            ->groupByRaw("DATE_FORMAT(datahora, '%Y-%m')")
            ->orderBy('periodo')
            ->get()
            ->keyBy('periodo');

        $serieMensal = [];
        for ($indice = 0; $indice < 12; $indice++) {
            $periodo = $inicioSerie->addMonths($indice)->format('Y-m');
            $total = $totaisMensais->get($periodo);
            $serieMensal[] = [
                'periodo' => $periodo,
                'litros' => round((float) ($total?->litros ?? 0), 2),
                'coletas' => (int) ($total?->coletas ?? 0),
            ];
        }

        $detail = $this->dailyDetail(CarbonImmutable::now(config('app.timezone')));

        return [
            'litros_mes_atual' => $mesAtual,
            'litros_mes_anterior' => $mesAnterior,
            'variacao_percentual' => $variacao,
            'serie_mensal' => $serieMensal,
            ...$detail,
        ];
    }

    private function dailyDetail(CarbonImmutable $reference): array
    {
        $schema = Schema::connection('raw');
        if (! $schema->hasTable('coletas')) {
            return ['serie_diaria' => [], 'rotas' => [], 'atualizado_em' => null];
        }

        $columns = collect([
            'produtor_codigo', 'litros', 'datahora', 'temperatura',
            'rota_uuid', 'rota_nome', 'motorista_nome', 'usuario',
        ])->filter(fn (string $column): bool => $schema->hasColumn('coletas', $column))->all();
        $rows = DB::connection('raw')->table('coletas')
            ->where('datahora', '>=', $reference->startOfDay()->subDays(59)->format('Y-m-d H:i:s'))
            ->where('datahora', '<', $reference->startOfDay()->addDay()->format('Y-m-d H:i:s'))
            ->orderBy('datahora')
            ->get($columns);

        return [
            ...$this->dailyCalculator->calculate($rows, $reference->toDateString(), 30),
            'atualizado_em' => $rows->max('datahora'),
        ];
    }
}
