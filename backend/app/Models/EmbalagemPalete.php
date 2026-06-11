<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmbalagemPalete extends Model
{
    protected $connection = 'raw';

    protected $table = 'embalagem_paletes';

    protected $fillable = [
        'lote_id',
        'numero',
        'caixas',
        'peso_total',
        'status',
        'etiqueta_token',
        'etiqueta_status',
        'etiqueta_impressa_at',
        'etiqueta_erro',
    ];

    protected $casts = [
        'lote_id' => 'integer',
        'numero' => 'integer',
        'caixas' => 'integer',
        'peso_total' => 'float',
        'etiqueta_impressa_at' => 'datetime',
    ];
}
