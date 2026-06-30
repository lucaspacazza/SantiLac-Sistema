<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProducaoFormulacaoCreme extends Model
{
    protected $connection = 'raw';

    protected $table = 'producao_formulacoes_creme';

    protected $fillable = [
        'documento_codigo',
        'documento_nome',
        'responsavel_monitoramento',
        'mes',
        'ano',
        'tipo_creme',
        'data_fabricacao',
        'lote_creme_produzido',
        'gordura_inicial',
        'gordura_final',
        'acidez',
        'responsavel',
        'responsavel_id',
        'status',
        'observacoes',
    ];

    protected $casts = [
        'mes' => 'integer',
        'ano' => 'integer',
        'data_fabricacao' => 'date',
        'gordura_inicial' => 'float',
        'gordura_final' => 'float',
        'acidez' => 'float',
        'responsavel_id' => 'integer',
    ];
}
