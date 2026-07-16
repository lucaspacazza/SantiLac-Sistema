<?php

namespace App\Models\Producao;

use App\Models\Concerns\ExcludesCancelledRecords;
use Illuminate\Database\Eloquent\Model;

class ProducaoSoroRefrigerado extends Model
{
    use ExcludesCancelledRecords;

    protected $connection = 'raw';

    protected $table = 'producao_soro_refrigerado';

    protected $fillable = [
        'documento_codigo',
        'documento_nome',
        'data_registro',
        'entrada_diaria_estoque',
        'estoque_total',
        'litragem_vendida',
        'sobra_estoque',
        'silo_armazenado',
        'responsavel',
        'responsavel_id',
        'status',
        'observacoes',
    ];

    protected $casts = [
        'data_registro' => 'date',
        'entrada_diaria_estoque' => 'float',
        'estoque_total' => 'float',
        'litragem_vendida' => 'float',
        'sobra_estoque' => 'float',
        'responsavel_id' => 'integer',
    ];
}
