<?php

namespace App\Services\Dashboard;

use App\Models\Pasteurizador\PasteurizadorAmostra;
use App\Services\Pasteurizador\PasteurizadorService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Schema;

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
            ...$this->temperatureDetail(),
        ];
    }

    private function temperatureDetail(): array
    {
        if (! Schema::connection('raw')->hasTable('pasteurizador_amostras')) {
            return ['temperatures' => [], 'temperatureMetrics' => null];
        }
        $latest = PasteurizadorAmostra::query()->where('canal', 'Temp.Pasteuriza')->max('timestamp_registro');
        if ($latest === null) {
            return ['temperatures' => [], 'temperatureMetrics' => null];
        }
        $start = CarbonImmutable::parse((string) $latest)->subHours(24);
        $samples = PasteurizadorAmostra::query()->where('canal', 'Temp.Pasteuriza')
            ->where('timestamp_registro', '>=', $start->format('Y-m-d H:i:s'))
            ->where('timestamp_registro', '<=', (string) $latest)
            ->orderBy('timestamp_registro')->get(['timestamp_registro', 'valor']);
        $series = $samples->groupBy(fn (PasteurizadorAmostra $sample): string => optional($sample->timestamp_registro)->format('Y-m-d H:00'))
            ->map(fn ($items, string $hour): array => [
                'hour' => CarbonImmutable::parse($hour)->format('H:i'),
                'timestamp' => $hour.':00',
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
