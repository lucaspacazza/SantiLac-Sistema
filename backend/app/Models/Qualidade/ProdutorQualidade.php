<?php

namespace App\Models\Qualidade;

use Illuminate\Database\Eloquent\Model;

class ProdutorQualidade extends Model
{
    protected $connection = 'raw';

    protected $table = 'produtores';

    public $timestamps = false;

    protected $casts = [
        'diario' => 'boolean',
        'ativo' => 'boolean',
        'novo' => 'boolean',
        'projeto' => 'boolean',
        'data_cadastro' => 'datetime',
        'data_inativacao' => 'datetime',
    ];
}
