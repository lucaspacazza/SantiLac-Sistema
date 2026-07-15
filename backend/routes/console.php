<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Services\Producao\OrdemProducaoService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('producao:reconciliar-ops-diarias {--data=}', function () {
    $resultado = app(OrdemProducaoService::class)->reconciliarOrdensDiarias($this->option('data') ?: null);

    $this->info("Grupos recalculados: {$resultado['grupos']}");
    $this->info("OPs duplicadas consolidadas: {$resultado['ordens_mescladas']}");
    foreach ($resultado['conflitos'] as $conflito) {
        $this->error($conflito);
    }

    return $resultado['conflitos'] === [] ? 0 : 1;
})->purpose('Agrupa formulações finalizadas em uma OP por dia e tipo de queijo.');
