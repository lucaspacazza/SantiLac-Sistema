<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class StockMovement extends Model
{
    protected $table = 'stock_movements';

    protected $fillable = [
        'product_id',
        'movement_type',
        'origin_type',
        'origin_id',
        'movement_date',
        'quantity_kg',
        'quantity_pieces',
        'notes',
    ];

    protected $casts = [
        'movement_date' => 'date',
        'quantity_kg' => 'float',
        'quantity_pieces' => 'float',
    ];
}
