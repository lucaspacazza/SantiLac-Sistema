<?php

use App\Http\Controllers\Api\Qualidade\QualidadeController;
use App\Http\Controllers\Api\Qualidade\RelatoriosController;
use Illuminate\Support\Facades\Route;

Route::prefix('qualidade')->group(function (): void {
    Route::get('/overview', [QualidadeController::class, 'overview']);

    Route::get('/analises', [QualidadeController::class, 'analises']);
    Route::post('/analises/importacoes', [QualidadeController::class, 'importarAnalises']);

    Route::get('/produtores', [QualidadeController::class, 'produtores']);
    Route::get('/produtores/{codigo}', [QualidadeController::class, 'produtor']);
    Route::get('/produtores/{codigo}/analises', [QualidadeController::class, 'analisesDoProdutor']);

    Route::get('/relatorios/resumo', [RelatoriosController::class, 'resumo']);
    Route::get('/relatorios/produtores/{codigo}/pendencias', [RelatoriosController::class, 'pendenciasProdutor']);
});
