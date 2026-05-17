<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class ProductionBatchItem extends Model
{
    protected $table = 'production_batch_items';

    protected $fillable = [
        'batch_id',
        'product_id',
        'production_type',
        'pieces_count',
        'weight_kg',
        'notes',
    ];

    protected $casts = [
        'pieces_count' => 'float',
        'weight_kg' => 'float',
    ];
}
