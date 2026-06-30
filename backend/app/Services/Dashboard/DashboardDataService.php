<?php

namespace App\Services\Dashboard;

use Illuminate\Support\Carbon;

class DashboardDataService
{
    public function normalizar(?string $data): Carbon
    {
        if ($data && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
            return Carbon::createFromFormat('Y-m-d', $data, 'America/Sao_Paulo')->startOfDay();
        }

        return now('America/Sao_Paulo')->startOfDay();
    }
}
