<?php

namespace App\Services\Dashboard;

use App\Services\Pasteurizador\PasteurizadorService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PasteurizadorResumoService
{
    private const CANAL = 'Temp.Pasteuriza';

    private const MAX_POINTS = 900;

    public function __construct(
        private readonly PasteurizadorService $pasteurizador,
    ) {}

    public function dia(Carbon $dia): array
    {
        $data = $dia->toDateString();
        $request = Request::create('/api/pasteurizador/amostras', 'GET', [
            'inicio' => $data,
            'fim' => $data,
            'hora_inicio' => '00:00:00',
            'hora_fim' => '23:59:59',
            'canal' => self::CANAL,
            'limit' => self::MAX_POINTS,
            'with_meta' => '1',
        ]);
        $series = $this->pasteurizador->amostrasPeriodo($request);
        $stats = $series['meta']['channels'][0] ?? null;
        $total = (int) ($stats['total'] ?? 0);
        $pontos = collect($series['items'])
            ->map(fn (array $item): array => [
                'timestamp' => $item['timestamp_registro'],
                'valor' => round((float) $item['valor'], 2),
            ])
            ->all();

        return [
            'data' => $data,
            'canal' => self::CANAL,
            'total_pontos' => $total,
            'media' => $total > 0 ? round((float) $stats['media'], 2) : null,
            'minima' => $total > 0 ? round((float) $stats['minimo'], 2) : null,
            'maxima' => $total > 0 ? round((float) $stats['maximo'], 2) : null,
            'pontos' => $pontos,
            'filtro' => [
                'inicio' => $data,
                'fim' => $data,
                'hora_inicio' => '00:00:00',
                'hora_fim' => '23:59:59',
                'canal' => self::CANAL,
            ],
        ];
    }
}
