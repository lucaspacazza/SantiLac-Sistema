<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;

class MobileProdutoresService
{
    public function listar(?string $rota): array
    {
        $rota = trim((string) $rota);
        if ($rota !== '' && preg_match('/^\d+$/', $rota) === 1) {
            $rota = (string) ((int) $rota);
        }

        $query = DB::connection('raw')
            ->table('produtores as p')
            ->leftJoin('produtor_endpoints as pe', 'pe.produtor_codigo', '=', 'p.codigo')
            ->select(
                'p.codigo',
                'p.nome',
                'p.rota',
                'p.cidade',
                'pe.lat as endpoint_lat',
                'pe.lng as endpoint_lng',
                'pe.samples as endpoint_samples',
                'pe.updated_at as endpoint_updated_ts'
            )
            ->where('p.ativo', 1);

        if ($rota !== '') {
            $query->where('p.rota', $rota);
        } else {
            $query->orderBy('p.rota');
        }

        $produtores = $query
            ->orderBy('p.nome')
            ->get()
            ->map(fn (object $row): array => [
                'codigo' => (string) $row->codigo,
                'nome' => (string) $row->nome,
                'rota' => $row->rota !== null ? (string) $row->rota : '',
                'cidade' => $row->cidade !== null ? (string) $row->cidade : null,
                'endpoint_lat' => $row->endpoint_lat,
                'endpoint_lng' => $row->endpoint_lng,
                'endpoint_samples' => $row->endpoint_samples,
                'endpoint_updated_ts' => $row->endpoint_updated_ts,
            ])
            ->all();

        return MobileResponse::ok([
            'rota' => $rota !== '' ? $rota : null,
            'total' => count($produtores),
            'produtores' => $produtores,
        ]);
    }
}
