<?php

namespace App\Services\Dashboard;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ProducaoResumoService
{
    public function home(): array
    {
        $ultimaData = DB::connection('raw')->table('producao_formulacoes_queijo')->max('data_formulacao');
        $litros = $ultimaData
            ? DB::connection('raw')->table('producao_formulacoes_queijo')
                ->whereDate('data_formulacao', (string) $ultimaData)
                ->sum('quantidade_leite')
            : 0;

        return [
            'ultima_data' => $ultimaData ? Carbon::parse((string) $ultimaData)->toDateString() : null,
            'litros' => round((float) $litros, 2),
            'lotes' => $this->ultimosLotes(),
        ];
    }

    public function dia(Carbon $dia): array
    {
        $lotes = DB::connection('raw')->table('producao_formulacoes_queijo')
            ->select(['id', 'tipo_queijo', 'lote_queijo', 'quantidade_leite', 'status', 'data_formulacao'])
            ->whereDate('data_formulacao', $dia->toDateString())
            ->orderByDesc('id')
            ->get();

        return [
            'data' => $dia->toDateString(),
            'litros' => round((float) $lotes->sum('quantidade_leite'), 2),
            'total_lotes' => $lotes->count(),
            'lotes' => $lotes->map(fn ($row): array => $this->formatarLote($row))->all(),
        ];
    }

    private function ultimosLotes(): array
    {
        return DB::connection('raw')->table('producao_formulacoes_queijo')
            ->select(['id', 'tipo_queijo', 'lote_queijo', 'quantidade_leite', 'status', 'data_formulacao'])
            ->orderByDesc('data_formulacao')
            ->orderByDesc('id')
            ->limit(8)
            ->get()
            ->map(fn ($row): array => $this->formatarLote($row))
            ->all();
    }

    private function formatarLote($row): array
    {
        return [
            'id' => (int) $row->id,
            'tipo' => (string) ($row->tipo_queijo ?? ''),
            'lote' => (string) ($row->lote_queijo ?? ''),
            'litros' => round((float) ($row->quantidade_leite ?? 0), 2),
            'status' => (string) ($row->status ?? ''),
            'data' => $row->data_formulacao ? Carbon::parse((string) $row->data_formulacao)->toDateString() : null,
        ];
    }
}
