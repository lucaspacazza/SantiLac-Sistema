<?php

namespace App\Services\Dashboard;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ColetasResumoService
{
    public function home(): array
    {
        $serie = DB::connection('raw')->table('coletas')
            ->selectRaw('DATE(datahora) as data, COALESCE(SUM(litros), 0) as litros, COUNT(*) as coletas')
            ->whereNotNull('datahora')
            ->groupByRaw('DATE(datahora)')
            ->orderByDesc('data')
            ->limit(14)
            ->get()
            ->reverse()
            ->values();

        $ultimo = $serie->last();

        return [
            'ultima_data' => $ultimo?->data,
            'litros' => round((float) ($ultimo?->litros ?? 0), 2),
            'coletas' => (int) ($ultimo?->coletas ?? 0),
            'serie' => $serie->map(fn ($row): array => [
                'data' => (string) $row->data,
                'litros' => round((float) $row->litros, 2),
                'coletas' => (int) $row->coletas,
            ])->all(),
        ];
    }

    public function dia(Carbon $dia): array
    {
        $row = DB::connection('raw')->table('coletas')
            ->selectRaw('COALESCE(SUM(litros), 0) as litros, COUNT(*) as coletas')
            ->whereDate('datahora', $dia->toDateString())
            ->first();

        return [
            'data' => $dia->toDateString(),
            'litros' => round((float) ($row?->litros ?? 0), 2),
            'coletas' => (int) ($row?->coletas ?? 0),
        ];
    }
}
