<?php

namespace App\Models\Expedicao;

use App\Models\Concerns\ExcludesCancelledRecords;
use Illuminate\Database\Eloquent\Model;

class ExpedicaoOrdem extends Model
{
    use ExcludesCancelledRecords;

    protected $connection = 'raw';

    protected $table = 'expedicao_ordens';

    protected $fillable = [
        'codigo',
        'cliente',
        'destino',
        'data_prevista',
        'placa',
        'motorista',
        'observacoes',
        'status',
        'paletes_total',
        'caixas_total',
        'peso_total',
        'criado_por',
        'lancado_por',
        'iniciado_por',
        'concluido_por',
        'cancelado_por',
        'lancada_at',
        'iniciada_at',
        'concluida_at',
        'cancelada_at',
        'cancelamento_snapshot',
    ];

    protected $casts = [
        'data_prevista' => 'date',
        'paletes_total' => 'integer',
        'caixas_total' => 'integer',
        'peso_total' => 'float',
        'criado_por' => 'integer',
        'lancado_por' => 'integer',
        'iniciado_por' => 'integer',
        'concluido_por' => 'integer',
        'cancelado_por' => 'integer',
        'lancada_at' => 'datetime',
        'iniciada_at' => 'datetime',
        'concluida_at' => 'datetime',
        'cancelada_at' => 'datetime',
        'cancelamento_snapshot' => 'array',
    ];
}
