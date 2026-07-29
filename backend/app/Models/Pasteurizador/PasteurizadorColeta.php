<?php

namespace App\Models\Pasteurizador;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PasteurizadorColeta extends Model
{
    protected $connection = 'raw';

    protected $table = 'pasteurizador_coletas';

    protected $fillable = [
        'equipamento',
        'origem',
        'arquivo_remoto',
        'arquivo_bruto_path',
        'coletado_em',
        'bytes_baixados',
        'total_amostras',
        'status',
        'mensagem_erro',
        'ingestion_key',
        'period_start',
        'period_end',
        'raw_sha256',
    ];

    protected $casts = [
        'coletado_em' => 'datetime',
        'period_start' => 'datetime',
        'period_end' => 'datetime',
        'bytes_baixados' => 'integer',
        'total_amostras' => 'integer',
    ];

    public function amostras(): HasMany
    {
        return $this->hasMany(PasteurizadorAmostra::class, 'coleta_id');
    }
}
