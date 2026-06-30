<?php

namespace App\Services\Dashboard;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PasteurizadorResumoService
{
    private const CANAL = 'Temp.Pasteuriza';

    public function dia(Carbon $dia): array
    {
        $query = DB::connection('raw')->table('pasteurizador_amostras')
            ->whereDate('timestamp_registro', $dia->toDateString())
            ->where('canal', self::CANAL);

        $stats = (clone $query)
            ->selectRaw('COUNT(*) as total, AVG(valor) as media, MIN(valor) as minima, MAX(valor) as maxima')
            ->first();

        $pontos = (clone $query)
            ->select(['timestamp_registro', 'valor'])
            ->orderBy('timestamp_registro')
            ->limit(900)
            ->get()
            ->map(fn ($row): array => [
                'timestamp' => $row->timestamp_registro ? (string) $row->timestamp_registro : null,
                'valor' => round((float) $row->valor, 2),
            ])
            ->all();

        $total = (int) ($stats?->total ?? 0);

        return [
            'data' => $dia->toDateString(),
            'canal' => self::CANAL,
            'total_pontos' => $total,
            'media' => $total > 0 ? round((float) $stats->media, 2) : null,
            'minima' => $total > 0 ? round((float) $stats->minima, 2) : null,
            'maxima' => $total > 0 ? round((float) $stats->maxima, 2) : null,
            'pontos' => $pontos,
            'filtro' => [
                'inicio' => $dia->toDateString(),
                'fim' => $dia->toDateString(),
                'hora_inicio' => '00:00:00',
                'hora_fim' => '23:59:59',
                'canal' => self::CANAL,
            ],
        ];
    }
}