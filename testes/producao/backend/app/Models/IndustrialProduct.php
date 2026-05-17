<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class IndustrialProduct extends Model
{
    protected $table = 'industrial_products';

    protected $fillable = ['code', 'name', 'category', 'unit', 'active'];

    protected $casts = [
        'active' => 'boolean',
    ];
}
