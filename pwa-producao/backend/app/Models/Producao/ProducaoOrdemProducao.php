<?php

namespace App\Models\Producao;

use Illuminate\Database\Eloquent\Model;

class ProducaoOrdemProducao extends Model
{
    protected $connection = 'raw';

    protected $table = 'ordens_producao';

    protected $fillable = [
        'codigo_ordem',
        'formulacao_queijo_id',
        'data_ordem',
        'campos_json',
        'origem',
        'status',
        'observacoes',
    ];

    protected $casts = [
        'formulacao_queijo_id' => 'integer',
        'data_ordem' => 'date',
    ];

    public function getCamposJsonAttribute($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }

    public function setCamposJsonAttribute($value): void
    {
        $this->attributes['campos_json'] = json_encode(
            is_array($value) ? $value : [],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
