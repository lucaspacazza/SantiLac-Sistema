<?php

namespace App\Models\Pasteurizador;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PasteurizadorAmostra extends Model
{
    protected $connection = 'raw';
    protected $table = 'pasteurizador_amostras';
    public $timestamps = false;

    protected $fillable = [
        'coleta_id',
        'equipamento',
        'canal',
        'unidade',
        'sample_index',
        'raw_offset',
        'timestamp_registro',
        'valor',
        'qualidade',
    ];

    protected $casts = [
        'sample_index' => 'integer',
        'raw_offset' => 'integer',
        'timestamp_registro' => 'datetime',
        'valor' => 'decimal:4',
        'qualidade' => 'decimal:4',
    ];

    public function coleta(): BelongsTo
    {
        return $this->belongsTo(PasteurizadorColeta::class, 'coleta_id');
    }
}
