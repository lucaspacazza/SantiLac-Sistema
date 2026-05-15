<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EstoqueItem extends Model
{
    protected $connection = 'raw';

    protected $table = 'estoque';

    protected $fillable = [
        'codigo',
        'nome',
        'categoria',
        'descricao',
        'unidade',
        'saldo_atual',
        'estoque_minimo',
        'ativo',
    ];

    protected $casts = [
        'saldo_atual' => 'float',
        'estoque_minimo' => 'float',
        'ativo' => 'boolean',
    ];
}
