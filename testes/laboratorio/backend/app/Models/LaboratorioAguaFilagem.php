<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LaboratorioAguaFilagem extends Model
{
    protected $connection = 'raw';

    protected $table = 'laboratorio_agua_filagem';

    protected $fillable = [
        'documento_codigo',
        'documento_nome',
        'data_monitoramento',
        'sequencia',
        'hora',
        'acidez',
        'gordura',
        'ph',
        'responsavel',
        'responsavel_id',
        'status',
        'observacoes',
    ];

    protected $casts = [
        'data_monitoramento' => 'date',
        'sequencia' => 'integer',
        'acidez' => 'float',
        'gordura' => 'float',
        'ph' => 'float',
        'responsavel_id' => 'integer',
    ];
}
