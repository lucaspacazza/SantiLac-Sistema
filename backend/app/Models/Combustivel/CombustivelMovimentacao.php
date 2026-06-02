<?php

namespace App\Models\Combustivel;

use Illuminate\Database\Eloquent\Model;

class CombustivelMovimentacao extends Model
{
    protected $table = 'combustivel_movimentacoes';

    protected $fillable = [
        'tipo',
        'quantidade_litros',
        'motorista_nome',
        'caminhao_nome',
        'placa',
        'km',
        'observacao',
        'usuario_id',
    ];

    protected $casts = [
        'quantidade_litros' => 'float',
        'km' => 'integer',
    ];
}
