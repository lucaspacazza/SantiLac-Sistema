<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Produtor extends Model
{
    protected $connection = 'raw';

    protected $table = 'produtores';

    public $timestamps = false;

    protected $fillable = [
        'codigo',
        'nome',
        'cidade',
        'rota',
        'diario',
        'endereco',
        'cep',
        'cpf_cnpj',
        'celular',
        'ativo',
        'novo',
        'data_cadastro',
        'data_inativacao',
        'projeto',
    ];

    protected $casts = [
        'diario' => 'boolean',
        'ativo' => 'boolean',
        'novo' => 'boolean',
        'projeto' => 'boolean',
        'data_cadastro' => 'datetime',
        'data_inativacao' => 'datetime',
    ];
}
