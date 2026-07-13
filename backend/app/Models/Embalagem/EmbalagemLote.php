<?php

namespace App\Models\Embalagem;

use Illuminate\Database\Eloquent\Model;

class EmbalagemLote extends Model
{
    protected $connection = 'raw';

    protected $table = 'embalagem_lotes';

    protected $fillable = [
        'ordem_producao_id',
        'codigo_ordem',
        'lote',
        'tipo_queijo',
        'data_fabricacao',
        'data_validade',
        'caixas_total',
        'pecas_total',
        'peso_total',
        'peso_pecas_avulsas',
        'status',
    ];

    protected $casts = [
        'ordem_producao_id' => 'integer',
        'data_fabricacao' => 'date',
        'data_validade' => 'date',
        'caixas_total' => 'integer',
        'pecas_total' => 'integer',
        'peso_total' => 'float',
        'peso_pecas_avulsas' => 'float',
    ];
}
