<?php

namespace App\Models\Estoque;

use Illuminate\Database\Eloquent\Model;

class EstoqueLog extends Model
{
    protected $connection = 'raw';

    protected $table = 'estoque_logs';

    protected $fillable = [
        'estoque_id',
        'tipo',
        'quantidade',
        'saldo_antes',
        'saldo_depois',
        'data_movimento',
        'documento',
        'motivo',
        'observacao',
        'usuario_id',
    ];

    protected $casts = [
        'quantidade' => 'float',
        'saldo_antes' => 'float',
        'saldo_depois' => 'float',
        'data_movimento' => 'date',
    ];
}
