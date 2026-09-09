<?php

namespace App\Services\Dashboard;

use App\Models\Pasteurizador\PasteurizadorAmostra;
use App\Services\Dashboard\Support\DashboardDateRange;
use App\Services\Pasteurizador\PasteurizadorService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Schema;

class PasteurizadorIndicadorService
{
    public function __construct(
        private readonly PasteurizadorService $pasteurizador,
    ) {}

    public function resumo(?DashboardDateRange $range = null): array
    {
        $range ??= DashboardDateRange::from();
        $overview = $this->pasteurizador->overview();
        $ultima = $overview['ultima_coleta'] ?? null;

        return [
            'amostras' => (int) ($overview['totais']['amostras'] ?? 0),
            'ultima_coleta' => is_array($ultima) ? [
                'status' => (string) ($ultima['status'] ?? 'rascunho'),
                'coletado_em' => $ultima['coletado_em'] ?? null,
                'total_amostras' => (int) ($ultima['total_amostras'] ?? 0),
            ] : null,
            ...$this->temperatureDetail($range),
        ];
    }

    private function temperatureDetail(DashboardDateRange $range): array
    {
        if (! Schema::connection('raw')->hasTable('pasteurizador_amostras')) {
            return ['temperatures' => [], 'temperatureMetrics' => null];
        }
        $latest = PasteurizadorAmostra::query()->where('canal', 'Temp.Pasteuriza')
            ->whereBetween('timestamp_registro', [$range->start->startOfDay(), $range->end->endOfDay()])
            ->max('timestamp_registro');
        if ($latest === null) {
            return ['temperatures' => [], 'temperatureMetrics' => null];
        }
        $samples = PasteurizadorAmostra::query()->where('canal', 'Temp.Pasteuriza')
            ->whereBetween('timestamp_registro', [$range->start->startOfDay(), $range->end->endOfDay()])
            ->orderBy('timestamp_registro')->get(['timestamp_registro', 'valor']);
        $hourly = $range->days() <= 2;
        $series = $samples->groupBy(fn (PasteurizadorAmostra $sample): string => optional($sample->timestamp_registro)->format($hourly ? 'Y-m-d H:00' : 'Y-m-d'))
            ->map(fn ($items, string $bucket): array => [
                'hour' => CarbonImmutable::parse($bucket)->format($hourly ? 'd/m H:i' : 'd/m'),
                'timestamp' => $hourly ? $bucket.':00' : $bucket.' 00:00:00',
                'value' => round((float) $items->avg('valor'), 2),
            ])->values()->all();
        $values = $samples->map(fn (PasteurizadorAmostra $sample): float => (float) $sample->valor);

        return [
            'temperatures' => $series,
            'temperatureMetrics' => [
                'min' => round((float) $values->min(), 2),
                'avg' => round((float) $values->avg(), 2),
                'max' => round((float) $values->max(), 2),
                'updatedAt' => (string) $latest,
            ],
        ];
    }
}
