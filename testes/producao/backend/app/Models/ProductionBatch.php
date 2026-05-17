<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class ProductionBatch extends Model
{
    protected $table = 'production_batches';

    protected $fillable = [
        'batch_date',
        'milk_entry_id',
        'liters_processed',
        'status',
        'notes',
        'closed_at',
        'reopened_at',
        'reopen_reason',
    ];

    protected $casts = [
        'batch_date' => 'date',
        'liters_processed' => 'float',
        'closed_at' => 'datetime',
        'reopened_at' => 'datetime',
    ];
}
