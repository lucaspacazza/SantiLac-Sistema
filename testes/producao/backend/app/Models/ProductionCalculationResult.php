<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class ProductionCalculationResult extends Model
{
    protected $table = 'production_calculation_results';

    protected $fillable = [
        'batch_id',
        'liters_processed',
        'total_produced_kg',
        'yield_liters_per_kg',
        'yield_kg_per_liter',
        'average_piece_weight',
        'result_payload',
        'calculated_at',
    ];

    protected $casts = [
        'liters_processed' => 'float',
        'total_produced_kg' => 'float',
        'yield_liters_per_kg' => 'float',
        'yield_kg_per_liter' => 'float',
        'average_piece_weight' => 'float',
        'result_payload' => 'array',
        'calculated_at' => 'datetime',
    ];
}
