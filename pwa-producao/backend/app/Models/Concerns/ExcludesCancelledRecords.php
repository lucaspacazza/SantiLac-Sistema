<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait ExcludesCancelledRecords
{
    protected static function bootExcludesCancelledRecords(): void
    {
        static::addGlobalScope('exclude_cancelled', function (Builder $query): void {
            $query->where($query->qualifyColumn('status'), '<>', 'cancelada');
        });
    }
}
