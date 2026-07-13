<?php

namespace App\Models\Producao;

use Illuminate\Database\Eloquent\Model;

class ProducaoFormulacaoQueijo extends Model
{
    protected $connection = 'raw';

    protected $table = 'producao_formulacoes_queijo';

    protected $fillable = [
        'codigo_formulacao',
        'documento_codigo',
        'documento_nome',
        'documento_revisao',
        'tipo_queijo',
        'data_formulacao',
        'silo',
        'lote_leite',
        'lote_queijo',
        'numero_queijomatic',
        'inicio_enchimento',
        'quantidade_leite',
        'temperatura_pasteurizacao',
        'fosfatase',
        'peroxidase',
        'gordura_inicial',
        'gordura_final',
        'acidez',
        'temperatura_coagulacao',
        'hora_coagulacao',
        'hora_corte',
        'temperatura_cozimento',
        'responsavel_id',
        'status',
        'observacoes',
        'insumos_json',
    ];

    protected $casts = [
        'data_formulacao' => 'date',
        'quantidade_leite' => 'float',
        'temperatura_pasteurizacao' => 'float',
        'gordura_inicial' => 'float',
        'gordura_final' => 'float',
        'acidez' => 'float',
        'temperatura_coagulacao' => 'float',
        'temperatura_cozimento' => 'float',
        'responsavel_id' => 'integer',
        'insumos_json' => 'array',
    ];
}
