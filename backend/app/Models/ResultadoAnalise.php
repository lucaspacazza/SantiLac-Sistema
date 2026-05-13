<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ResultadoAnalise extends Model
{
    protected $connection = 'raw';

    protected $table = 'resultadosanalises';

    public $timestamps = true;

    const CREATED_AT = 'created_at';

    const UPDATED_AT = 'updated_at';

    protected $casts = [
        'data' => 'date',
        'gordura' => 'float',
        'proteina' => 'float',
        'lactose' => 'float',
        'solidos_totais' => 'float',
        'ccs' => 'integer',
        'ufc' => 'integer',
        'caseina' => 'float',
        'sng' => 'float',
        'ureia' => 'float',
        'antibiotico' => 'float',
        'bacteria' => 'float',
        'temperatura' => 'float',
    ];
}
