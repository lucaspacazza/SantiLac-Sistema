<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LaboratorioCronograma extends Model
{
    protected $connection = 'raw';

    protected $table = 'laboratorio_cronogramas';

    protected $fillable = [
        'documento_codigo',
        'documento_nome',
        'documento_revisao',
        'ano',
        'titulo',
        'responsavel_tecnico_id',
        'status',
        'observacoes',
        'itens_json',
    ];

    protected $casts = [
        'ano' => 'integer',
        'responsavel_tecnico_id' => 'integer',
        'itens_json' => 'array',
    ];
}
