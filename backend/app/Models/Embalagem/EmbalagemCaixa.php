<?php

namespace App\Models\Embalagem;

use Illuminate\Database\Eloquent\Model;

class EmbalagemCaixa extends Model
{
    protected $connection = 'raw';

    protected $table = 'embalagem_caixas';

    protected $fillable = [
        'lote_id',
        'palete_id',
        'sequencia',
        'codigo_barra',
        'peso',
    ];

    protected $casts = [
        'lote_id' => 'integer',
        'palete_id' => 'integer',
        'sequencia' => 'integer',
        'peso' => 'float',
    ];
}
