<?php

namespace App\Models\Producao;

use App\Models\Concerns\ExcludesCancelledRecords;
use Illuminate\Database\Eloquent\Model;

class ProducaoCreme extends Model
{
    use ExcludesCancelledRecords;

    protected $connection = 'raw';

    protected $table = 'producao_creme';

    protected $fillable = [
        'documento_codigo',
        'documento_nome',
        'responsavel_monitoramento',
        'mes',
        'ano',
        'tipo_creme',
        'data_fabricacao',
        'lote_creme_produzido',
        'quantidade_produzida_kg',
        'responsavel',
        'responsavel_id',
        'status',
        'observacoes',
    ];

    protected $casts = [
        'mes' => 'integer',
        'ano' => 'integer',
        'data_fabricacao' => 'date',
        'quantidade_produzida_kg' => 'float',
        'responsavel_id' => 'integer',
    ];
}
