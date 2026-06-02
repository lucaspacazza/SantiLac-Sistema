<?php

namespace App\Models\Combustivel;

use Illuminate\Database\Eloquent\Model;

class CombustivelLog extends Model
{
    public $timestamps = false;

    protected $table = 'combustivel_logs';

    protected $fillable = [
        'acao',
        'descricao',
        'movimentacao_id',
        'usuario_id',
        'metadata',
        'created_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];
}
