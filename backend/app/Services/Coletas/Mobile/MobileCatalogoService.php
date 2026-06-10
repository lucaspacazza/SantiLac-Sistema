<?php

namespace App\Services\Coletas\Mobile;

use Illuminate\Support\Facades\DB;

class MobileCatalogoService
{
    public function catalogo(): array
    {
        $caminhoes = DB::connection('raw')
            ->table('caminhoes')
            ->select('id', 'identificacao', 'placa')
            ->where('ativo', 1)
            ->orderBy('identificacao')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (string) $row->id,
                'identificacao' => (string) $row->identificacao,
                'placa' => $row->placa !== null ? (string) $row->placa : null,
            ])
            ->all();

        $motoristas = DB::connection('raw')
            ->table('motoristas')
            ->select('id', 'nome')
            ->where('ativo', 1)
            ->orderBy('nome')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (string) $row->id,
                'nome' => (string) $row->nome,
            ])
            ->all();

        return MobileResponse::ok([
            'total_caminhoes' => count($caminhoes),
            'total_motoristas' => count($motoristas),
            'caminhoes' => $caminhoes,
            'motoristas' => $motoristas,
        ]);
    }
}
