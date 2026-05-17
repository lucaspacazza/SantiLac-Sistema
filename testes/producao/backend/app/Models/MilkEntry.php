<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class MilkEntry extends Model
{
    protected $table = 'milk_entries';

    protected $fillable = [
        'entry_date',
        'liters_received',
        'liters_processed',
        'liters_to_cream',
        'liters_surplus',
        'difference_liters',
        'milk_balance',
        'notes',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'liters_received' => 'float',
        'liters_processed' => 'float',
        'liters_to_cream' => 'float',
        'liters_surplus' => 'float',
        'difference_liters' => 'float',
        'milk_balance' => 'float',
    ];
}
