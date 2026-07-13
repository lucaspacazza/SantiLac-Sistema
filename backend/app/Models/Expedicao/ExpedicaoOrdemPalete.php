<?php

namespace App\Models\Expedicao;

use Illuminate\Database\Eloquent\Model;

class ExpedicaoOrdemPalete extends Model
{
    protected $connection = 'raw';

    protected $table = 'expedicao_ordem_paletes';

    protected $fillable = [
        'ordem_id',
        'palete_id',
        'status',
        'escaneado_por',
        'escaneado_at',
    ];

    protected $casts = [
        'ordem_id' => 'integer',
        'palete_id' => 'integer',
        'escaneado_por' => 'integer',
        'escaneado_at' => 'datetime',
    ];
}
