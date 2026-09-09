<?php

namespace App\Services\Dashboard;

use App\Models\Qualidade\ProdutorQualidade;
use App\Services\Dashboard\Support\DashboardDateRange;
use App\Services\Qualidade\RelatoriosV2Service;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class QualidadeIndicadorService
{
    private const ANALISES_TABLE = 'resultadosanalises';

    public function __construct(
        private readonly RelatoriosV2Service $reports,
    ) {}

    public function resumo(?DashboardDateRange $range = null): array
    {
        $range ??= DashboardDateRange::from();
        $produtoresAtivos = ProdutorQualidade::query()->where('ativo', 1)->count();

        if (! Schema::connection('raw')->hasTable(self::ANALISES_TABLE)) {
            return [
                'produtores_ativos' => $produtoresAtivos,
                'produtores_com_analise' => 0,
                'produtores_sem_analise' => $produtoresAtivos,
                'ultima_analise' => null,
                'quality' => $this->emptyQuality($produtoresAtivos),
            ];
        }

        $analises = DB::connection('raw')
            ->table(self::ANALISES_TABLE.' as ra')
            ->join('produtores as p', 'p.codigo', '=', 'ra.produtor_codigo')
            ->where('p.ativo', 1)
            ->whereBetween('ra.data', [$range->startDate(), $range->endDate()]);
        $produtoresComAnalise = (clone $analises)
            ->whereNotNull('ra.produtor_codigo')
            ->distinct('ra.produtor_codigo')
            ->count('ra.produtor_codigo');

        return [
            'produtores_ativos' => $produtoresAtivos,
            'produtores_com_analise' => $produtoresComAnalise,
            'produtores_sem_analise' => max($produtoresAtivos - $produtoresComAnalise, 0),
            'ultima_analise' => (clone $analises)->max('ra.data'),
            'quality' => $this->qualityDetail($produtoresAtivos, $range),
        ];
    }

    private function qualityDetail(int $activeProducers, DashboardDateRange $range): array
    {
        $start = $range->startDate();
        $end = $range->endDate();
        $rows = DB::connection('raw')->table(self::ANALISES_TABLE)
            ->whereBetween('data', [$start, $end])
            ->orderBy('data')
            ->orderBy('id')
            ->get(['id', 'produtor_codigo', 'data', 'gordura', 'proteina', 'solidos_totais', 'ccs', 'ufc'])
            ->keyBy(fn (object $item): string => (string) $item->produtor_codigo)
            ->values();
        $report = $this->reports->resumo(['data_inicio' => $start, 'data_fim' => $end]);
        $priorities = collect($report['prioridades']['criticos'] ?? [])
            ->concat($report['prioridades']['fora_padrao'] ?? [])
            ->take(12)
            ->map(function (array $item): array {
                $indicators = collect($item['indicadores_fora_padrao'] ?? [])->join(', ');
                return [
                    'producer' => (string) ($item['nome'] ?? $item['codigo'] ?? 'Produtor'),
                    'route' => (string) ($item['rota'] ?? ''),
                    'issue' => $indicators !== '' ? 'Fora do padrão: '.$indicators : 'Ocorrência crítica',
                    'value' => (string) ($item['data_analise'] ?? ''),
                ];
            })->values()->all();
        $average = fn (string $field): ?float => $rows->whereNotNull($field)->isEmpty()
            ? null
            : round((float) $rows->whereNotNull($field)->avg($field), 2);
        $executive = $report['executivo'] ?? [];

        return [
            'fat' => $average('gordura'),
            'protein' => $average('proteina'),
            'solids' => $average('solidos_totais'),
            'ccs' => $average('ccs'),
            'cbt' => $average('ufc'),
            'conformity' => (float) ($executive['conformidade_percentual'] ?? 0),
            'analyzed' => (int) ($executive['produtores_analisados'] ?? 0),
            'missing' => max($activeProducers - (int) ($executive['produtores_analisados'] ?? 0), 0),
            'issues' => $priorities,
            'updatedAt' => $rows->max('data'),
        ];
    }

    private function emptyQuality(int $activeProducers): array
    {
        return [
            'fat' => null, 'protein' => null, 'solids' => null, 'ccs' => null, 'cbt' => null,
            'conformity' => 0.0, 'analyzed' => 0, 'missing' => $activeProducers,
            'issues' => [], 'updatedAt' => null,
        ];
    }
}
